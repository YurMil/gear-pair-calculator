/// <reference lib="webworker" />

import type { OpenCascadeInstance } from 'replicad-opencascadejs';
import replicadWasmUrl from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import type {
  CadWorkerMessage,
  CadWorkerRequest,
  CadWorkerResultMessage,
  CadWorkerProgressMessage
} from './cad-worker-protocol';
import type { Point2D } from '../domain/types';

type ReplicadModule = typeof import('replicad');

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
        import('replicad-opencascadejs')
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

const postError = (requestId: string, error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const message: CadWorkerResultMessage = {
    type: 'result',
    requestId,
    ok: false,
    payload: {message: err.message, stack: err.stack},
  };
  post(message);
};

const buildGearSolid = (
  points: Point2D[],
  bore: number,
  faceWidth: number,
  hubD: number,
  hubL: number,
  keyway: boolean,
  replicad: any
) => {
  const draw = replicad.draw || replicad.default?.draw;
  const makeCylinder = replicad.makeCylinder || replicad.default?.makeCylinder;
  const makeBox = replicad.makeBox || replicad.default?.makeBox;

  if (typeof draw !== 'function') {
    throw new Error('Replicad draw() function is not available.');
  }

  // Create 2D teeth profile
  let sketch = draw();
  sketch.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    sketch.lineTo(points[i].x, points[i].y);
  }
  sketch.close();

  // Extrude to face width
  let solid = sketch.sketchOnPlane().extrude(faceWidth);

  // Apply bore cutout
  if (bore > 0 && typeof makeCylinder === 'function') {
    const boreCylinder = makeCylinder(bore / 2, faceWidth);
    solid = solid.cut(boreCylinder);
  }

  // Apply hub
  if (hubD > bore && hubL > 0 && typeof makeCylinder === 'function') {
    let hub = makeCylinder(hubD / 2, hubL).translate(0, 0, faceWidth);
    if (bore > 0) {
      const hubBore = makeCylinder(bore / 2, hubL).translate(0, 0, faceWidth);
      hub = hub.cut(hubBore);
    }
    solid = solid.fuse(hub);
  }

  // Apply keyway
  if (keyway && bore > 0 && typeof makeBox === 'function') {
    const shaftD = bore;
    const kwWidth = Math.max(2, 0.25 * shaftD);
    const kwHeight = 0.62 * shaftD; // height from center
    const totalLength = faceWidth + Math.max(0, hubL);
    
    // We position keyway cut centered on X, above center in Y
    const keyBox = makeBox([-kwWidth / 2, 0, 0], [kwWidth / 2, kwHeight, totalLength]);
    solid = solid.cut(keyBox);
  }

  return solid;
};

ctx.onmessage = async (event: MessageEvent<CadWorkerRequest>) => {
  const request = event.data;
  if (!request || typeof request !== 'object') return;

  const requestId = request.requestId;

  try {
    if (request.type === 'warmup') {
      post({type: 'progress', requestId, stage: 'init', done: 0, total: 1});
      await ensureOpenCascade();
      post({type: 'progress', requestId, stage: 'init', done: 1, total: 1});
      
      const empty = new ArrayBuffer(0);
      post({
        type: 'result',
        requestId,
        ok: true,
        payload: {pinionStep: empty, gearStep: empty, assemblyStep: empty}
      });
      return;
    }

    if (request.type !== 'generate-step') {
      throw new Error(`Unknown cad-worker request type: ${(request as any).type}`);
    }

    post({type: 'progress', requestId, stage: 'init', done: 0, total: 1});
    const oc = await ensureOpenCascade();
    const replicadModule = await loadReplicad();
    post({type: 'progress', requestId, stage: 'init', done: 1, total: 1});

    const { gearInput, pinionPoints, gearPoints, aw } = request;

    // 1. Generate Pinion
    post({type: 'progress', requestId, stage: 'pinion', done: 0, total: 1});
    const pinionSolid = buildGearSolid(
      pinionPoints,
      gearInput.bore1,
      gearInput.faceWidth,
      gearInput.hubD1,
      gearInput.hubL1,
      gearInput.keyway1,
      replicadModule
    );
    post({type: 'progress', requestId, stage: 'pinion', done: 1, total: 1});

    // 2. Generate Gear
    post({type: 'progress', requestId, stage: 'gear', done: 0, total: 1});
    const gearSolid = buildGearSolid(
      gearPoints,
      gearInput.bore2,
      gearInput.faceWidth,
      gearInput.hubD2,
      gearInput.hubL2,
      gearInput.keyway2,
      replicadModule
    );
    post({type: 'progress', requestId, stage: 'gear', done: 1, total: 1});

    // 3. Generate Assembly
    post({type: 'progress', requestId, stage: 'assembly', done: 0, total: 1});
    
    // Position gear correctly for engaged assembly
    const gearBaseAngle = gearInput.z2 % 2 === 0 ? Math.PI + Math.PI / gearInput.z2 : Math.PI;
    const positionedGearSolid = gearSolid
      .clone()
      .rotate((gearBaseAngle * 180) / Math.PI)
      .translate(aw, 0, 0);

    const makeCompound = (replicadModule as any).makeCompound || (replicadModule as any).default?.makeCompound;
    let assemblySolid = null;
    if (typeof makeCompound === 'function') {
      assemblySolid = makeCompound([pinionSolid, positionedGearSolid]);
    } else {
      assemblySolid = pinionSolid.fuse(positionedGearSolid);
    }
    post({type: 'progress', requestId, stage: 'assembly', done: 1, total: 1});

    // 4. Export STEP buffers
    post({type: 'progress', requestId, stage: 'export', done: 0, total: 3});
    
    const pBlob = pinionSolid.blobSTEP();
    const pBuffer = await pBlob.arrayBuffer();
    post({type: 'progress', requestId, stage: 'export', done: 1, total: 3});

    const gBlob = gearSolid.blobSTEP();
    const gBuffer = await gBlob.arrayBuffer();
    post({type: 'progress', requestId, stage: 'export', done: 2, total: 3});

    const aBlob = assemblySolid.blobSTEP();
    const aBuffer = await aBlob.arrayBuffer();
    post({type: 'progress', requestId, stage: 'export', done: 3, total: 3});

    post({
      type: 'result',
      requestId,
      ok: true,
      payload: {
        pinionStep: pBuffer,
        gearStep: gBuffer,
        assemblyStep: aBuffer
      }
    }, [pBuffer, gBuffer, aBuffer]);

  } catch (error) {
    postError(requestId, error);
  }
};
