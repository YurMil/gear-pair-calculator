/// <reference lib="webworker" />

import type { OpenCascadeInstance } from 'replicad-opencascadejs';
import replicadWasmUrl from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import type {
  CadWorkerMessage,
  CadWorkerRequest,
  CadWorkerResultMessage,
  CadWorkerProgressStage,
  CadWorkerBuildKind,
} from './cad-worker-protocol';
import type { GearInput, Point2D } from '../domain/types';
import { generateGearProfile } from '../domain/involute';

type ReplicadModule = typeof import('replicad');

// STEP profile density (higher than 2D/3D preview — exports are written once and consumed by external CAD).
const STEP_FLANK_POINTS = 32;
const STEP_ROOT_POINTS = 8;

let replicadPromise: Promise<ReplicadModule> | null = null;
let ocInitPromise: Promise<OpenCascadeInstance> | null = null;

const loadReplicad = () => {
  if (!replicadPromise) {
    replicadPromise = import('replicad');
  }
  return replicadPromise;
};

const ensureOpenCascade = async () => {
  if (!ocInitPromise) {
    ocInitPromise = (async () => {
      const [replicadModule, ocModule] = await Promise.all([
        loadReplicad(),
        import('replicad-opencascadejs'),
      ]);
      const ocFactory = ocModule.default as unknown as (options?: {
        locateFile?: (path: string, scriptDir: string) => string;
      }) => Promise<OpenCascadeInstance>;

      const oc = await ocFactory({
        locateFile: (path) => (path.endsWith('.wasm') ? replicadWasmUrl : path),
      });
      replicadModule.setOC(oc);
      return oc;
    })();
  }

  try {
    return await ocInitPromise;
  } catch (error) {
    ocInitPromise = null;
    throw error;
  }
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const post = (message: CadWorkerMessage, transfer?: Transferable[]) => {
  ctx.postMessage(message, transfer ?? []);
};

const progress = (requestId: string, stage: CadWorkerProgressStage, done: number, total: number) => {
  post({ type: 'progress', requestId, stage, done, total });
};

const postError = (requestId: string, error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const message: CadWorkerResultMessage = {
    type: 'result',
    requestId,
    ok: false,
    payload: { message: err.message, stack: err.stack },
  };
  post(message);
};

const buildShaftSolid = (diameter: number, length: number, keyway: boolean, replicad: any) => {
  const makeCylinder = replicad.makeCylinder || replicad.default?.makeCylinder;
  const makeBox = replicad.makeBox || replicad.default?.makeBox;
  if (!makeCylinder || length <= 0 || diameter <= 0) return null;

  let shaft = makeCylinder(diameter / 2, length).translate(0, 0, -length * 0.2);

  if (keyway && makeBox && typeof shaft.cut === 'function') {
    const kwWidth = Math.max(2, 0.25 * diameter);
    const kwDepth = 0.12 * diameter;
    const keyBox = makeBox(
      [-kwWidth / 2, diameter / 2 - kwDepth, -length * 0.2],
      [kwWidth / 2, diameter / 2 + 1, length * 0.8]
    );
    shaft = shaft.cut(keyBox);
  }
  return shaft;
};

const buildGearSolid = (
  points: Point2D[],
  bore: number,
  faceWidth: number,
  hubD: number,
  hubL: number,
  keyway: boolean,
  chamferEdges: boolean,
  moduleVal: number,
  replicad: any
) => {
  const drawPointsInterpolation =
    replicad.drawPointsInterpolation || replicad.default?.drawPointsInterpolation;
  const draw = replicad.draw || replicad.default?.draw;
  const makeCylinder = replicad.makeCylinder || replicad.default?.makeCylinder;
  const makeBox = replicad.makeBox || replicad.default?.makeBox;

  // Sketch the tooth profile as a smooth interpolated B-spline rather than a
  // polyline of ~N straight segments. CAD downstream sees one continuous curve
  // per closed loop, the extruded sides become smooth surfaces, and the chamfer
  // operates on a single outline edge instead of N edge segments.
  let drawing: any;
  if (typeof drawPointsInterpolation === 'function') {
    const fitPoints: Array<[number, number]> = points.map((p) => [p.x, p.y]);
    drawing = drawPointsInterpolation(
      fitPoints,
      { degMax: 3, degMin: 3 },
      { closeShape: true }
    );
  } else if (typeof draw === 'function') {
    // Fallback if the interpolation helper isn't exposed in this build of replicad.
    let s = draw([points[0].x, points[0].y]);
    for (let i = 1; i < points.length; i++) {
      s = s.lineTo([points[i].x, points[i].y]);
    }
    drawing = s.close();
  } else {
    throw new Error('Replicad drawing API is not available.');
  }

  let solid = drawing.sketchOnPlane().extrude(faceWidth);

  if (chamferEdges && typeof solid.chamfer === 'function') {
    try {
      const cDist = Math.min(1.0, moduleVal * 0.1);
      // Restrict the chamfer to the top and bottom face outlines only.
      // Without a filter, OpenCascade processes every edge — including the
      // ~N vertical seams between adjacent flank strips — which dominates
      // STEP build time for high-density profiles. The face-outline edges
      // are what an engineer actually wants chamfered anyway (deburr at
      // the gear faces, not at every tooth-flank intersection).
      solid = solid.chamfer(cDist, (e: any) =>
        e.either([
          (f: any) => f.inPlane('XY', 0),
          (f: any) => f.inPlane('XY', faceWidth),
        ])
      );
    } catch (e) {
      console.warn('Chamfer operation failed or topology error, skipping chamfer.', e);
    }
  }

  if (bore > 0 && typeof makeCylinder === 'function') {
    const boreCylinder = makeCylinder(bore / 2, faceWidth);
    solid = solid.cut(boreCylinder);
  }

  if (hubD > bore && hubL > 0 && typeof makeCylinder === 'function') {
    let hub = makeCylinder(hubD / 2, hubL).translate(0, 0, faceWidth);
    if (bore > 0) {
      const hubBore = makeCylinder(bore / 2, hubL).translate(0, 0, faceWidth);
      hub = hub.cut(hubBore);
    }
    solid = solid.fuse(hub);
  }

  if (keyway && bore > 0 && typeof makeBox === 'function') {
    const shaftD = bore;
    const kwWidth = Math.max(2, 0.25 * shaftD);
    const kwHeight = 0.62 * shaftD;
    const totalLength = faceWidth + Math.max(0, hubL);

    const keyBox = makeBox([-kwWidth / 2, 0, 0], [kwWidth / 2, kwHeight, totalLength]);
    solid = solid.cut(keyBox);
  }

  return solid;
};

// For assemblies — two distinct rigid bodies in one STEP container.
const compoundParts = (a: any, b: any, replicad: any) => {
  const makeCompound = (replicad as any).makeCompound || (replicad as any).default?.makeCompound;
  if (typeof makeCompound === 'function') return makeCompound([a, b]);
  return a.fuse(b);
};

// For individual parts — boolean-union into a single continuous solid body.
// Single body is what a manufacturer / downstream CAD expects: no overlapping
// shells, no z-fighting between the shaft cylinder and the bore hole, mass
// properties and surfaces unify cleanly.
const fuseToSingleBody = (a: any, b: any) => a.fuse(b);

// Build pinion (gear + shaft) at origin.
const buildPinionGroup = (
  gearInput: GearInput,
  deltaY: number,
  replicad: any,
  requestId: string,
  shareProgress: boolean
) => {
  if (shareProgress) progress(requestId, 'profile', 0, 1);
  const pts = generateGearProfile(
    gearInput.z1,
    gearInput.module,
    gearInput.pressureAngle,
    gearInput.x1,
    gearInput.addendumCoeff,
    gearInput.dedendumCoeff,
    deltaY,
    STEP_FLANK_POINTS,
    STEP_ROOT_POINTS
  );
  if (shareProgress) progress(requestId, 'profile', 1, 1);

  if (shareProgress) progress(requestId, 'solid', 0, 1);
  const gear = buildGearSolid(
    pts,
    gearInput.bore1,
    gearInput.faceWidth,
    gearInput.hubD1,
    gearInput.hubL1,
    gearInput.keyway1,
    gearInput.chamferEdges,
    gearInput.module,
    replicad
  );
  const shaft = buildShaftSolid(gearInput.bore1, gearInput.shaftL1, gearInput.keyway1, replicad);
  const group = shaft ? fuseToSingleBody(gear, shaft) : gear;
  if (shareProgress) progress(requestId, 'solid', 1, 1);
  return group;
};

// Build gear (gear + shaft) at origin.
const buildGearGroup = (
  gearInput: GearInput,
  deltaY: number,
  replicad: any,
  requestId: string,
  shareProgress: boolean
) => {
  if (shareProgress) progress(requestId, 'profile', 0, 1);
  const pts = generateGearProfile(
    gearInput.z2,
    gearInput.module,
    gearInput.pressureAngle,
    gearInput.x2,
    gearInput.addendumCoeff,
    gearInput.dedendumCoeff,
    deltaY,
    STEP_FLANK_POINTS,
    STEP_ROOT_POINTS
  );
  if (shareProgress) progress(requestId, 'profile', 1, 1);

  if (shareProgress) progress(requestId, 'solid', 0, 1);
  const gear = buildGearSolid(
    pts,
    gearInput.bore2,
    gearInput.faceWidth,
    gearInput.hubD2,
    gearInput.hubL2,
    gearInput.keyway2,
    gearInput.chamferEdges,
    gearInput.module,
    replicad
  );
  const shaft = buildShaftSolid(gearInput.bore2, gearInput.shaftL2, gearInput.keyway2, replicad);
  const group = shaft ? fuseToSingleBody(gear, shaft) : gear;
  if (shareProgress) progress(requestId, 'solid', 1, 1);
  return group;
};

const buildAssemblyGroup = (
  gearInput: GearInput,
  deltaY: number,
  aw: number,
  replicad: any,
  requestId: string
) => {
  // Report progress around each heavy solid build. `done` indexes which gear we're on,
  // so the client can display "pinion 1/2" then "gear 2/2".
  progress(requestId, 'solid', 0, 2);
  const pinionGroup = buildPinionGroup(gearInput, deltaY, replicad, requestId, false);
  progress(requestId, 'solid', 1, 2);
  const gearGroup = buildGearGroup(gearInput, deltaY, replicad, requestId, false);
  progress(requestId, 'solid', 2, 2);

  progress(requestId, 'compound', 0, 1);
  const gearBaseAngle = gearInput.z2 % 2 === 0 ? Math.PI + Math.PI / gearInput.z2 : Math.PI;
  const positionedGear = gearGroup
    .clone()
    .rotate((gearBaseAngle * 180) / Math.PI)
    .translate(aw, 0, 0);
  const assembly = compoundParts(pinionGroup, positionedGear, replicad);
  progress(requestId, 'compound', 1, 1);
  return assembly;
};

const buildByKind = (
  kind: CadWorkerBuildKind,
  gearInput: GearInput,
  deltaY: number,
  aw: number,
  replicad: any,
  requestId: string
) => {
  if (kind === 'pinion') return buildPinionGroup(gearInput, deltaY, replicad, requestId, true);
  if (kind === 'gear') return buildGearGroup(gearInput, deltaY, replicad, requestId, true);
  return buildAssemblyGroup(gearInput, deltaY, aw, replicad, requestId);
};

ctx.onmessage = async (event: MessageEvent<CadWorkerRequest>) => {
  const request = event.data;
  if (!request || typeof request !== 'object') return;

  const requestId = request.requestId;

  try {
    if (request.type === 'warmup') {
      progress(requestId, 'init', 0, 1);
      await ensureOpenCascade();
      progress(requestId, 'init', 1, 1);
      post({
        type: 'result',
        requestId,
        ok: true,
        payload: { step: new ArrayBuffer(0) },
      });
      return;
    }

    if (request.type !== 'build') {
      throw new Error(`Unknown cad-worker request type: ${(request as any).type}`);
    }

    progress(requestId, 'init', 0, 1);
    await ensureOpenCascade();
    const replicadModule = await loadReplicad();
    progress(requestId, 'init', 1, 1);

    const { kind, gearInput, deltaY, aw } = request;
    const solid = buildByKind(kind, gearInput, deltaY, aw, replicadModule, requestId);

    progress(requestId, 'export', 0, 1);
    const blob = solid.blobSTEP();
    const buffer = await blob.arrayBuffer();
    progress(requestId, 'export', 1, 1);

    post(
      {
        type: 'result',
        requestId,
        ok: true,
        payload: { step: buffer },
      },
      [buffer]
    );
  } catch (error) {
    postError(requestId, error);
  }
};
