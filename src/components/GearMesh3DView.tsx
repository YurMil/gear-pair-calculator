import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import * as THREE from 'three';
import { generateGearProfile } from '../domain/involute';
import type { CalculationResult } from '../domain/types';

interface GearMesh3DViewProps {
  result: CalculationResult;
  isAnimating: boolean;
  animationSpeed: number;
}

const FLANK_POINTS = 24;
const ROOT_POINTS = 8;

// Bore profile with optional keyway slot, used both for gear body and hub.
function createBorePath(bore: number, keyway: boolean): THREE.Path {
  const path = new THREE.Path();
  const R = bore / 2;
  if (bore <= 0) return path;

  if (keyway) {
    const W = Math.max(2, 0.25 * bore);
    const H = 0.62 * bore;
    const halfW = W / 2;
    const yIntersect = Math.sqrt(Math.max(0, R * R - halfW * halfW));
    const theta1 = Math.atan2(yIntersect, halfW);
    const theta2 = Math.atan2(yIntersect, -halfW);

    path.moveTo(-halfW, yIntersect);
    path.lineTo(-halfW, H);
    path.lineTo(halfW, H);
    path.lineTo(halfW, yIntersect);
    path.absarc(0, 0, R, theta1, theta2, true);
  } else {
    path.absarc(0, 0, R, 0, Math.PI * 2, true);
  }
  return path;
}

// Shaft cross-section as a closed THREE.Shape (with optional flat for the keyway).
// For keyway: the cross-section is the round shaft MINUS a flat slot near the top.
// Boundary goes along the flat then sweeps the long way (through the bottom) back to
// the other end of the flat — hence the clockwise arc from theta1 → theta2.
function createShaftShape(bore: number, keyway: boolean): THREE.Shape | null {
  if (bore <= 0) return null;
  const shape = new THREE.Shape();
  const R = bore / 2;
  if (keyway) {
    const kwDepth = 0.12 * bore;
    const yFlat = R - kwDepth;
    const halfW = Math.sqrt(Math.max(0, R * R - yFlat * yFlat));
    const theta1 = Math.atan2(yFlat, halfW);
    const theta2 = Math.atan2(yFlat, -halfW);
    shape.moveTo(-halfW, yFlat);
    shape.lineTo(halfW, yFlat);
    shape.absarc(0, 0, R, theta1, theta2, true);
  } else {
    shape.absarc(0, 0, R, 0, Math.PI * 2, false);
  }
  return shape;
}

function buildGearShape(
  points: { x: number; y: number }[],
  bore: number,
  keyway: boolean
): THREE.Shape | null {
  if (points.length === 0) return null;
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();
  if (bore > 0) {
    shape.holes.push(createBorePath(bore, keyway));
  }
  return shape;
}

// Auto-dispose hook: ensures the previous geometry is freed when deps change or component unmounts.
function useDisposable<T extends { dispose: () => void } | null>(geom: T): T {
  useEffect(() => {
    return () => {
      if (geom) geom.dispose();
    };
  }, [geom]);
  return geom;
}

function GearScene({ result, isAnimating, animationSpeed }: GearMesh3DViewProps) {
  const { geometry, gearInput } = result;
  const { pinion, gear, aw, ratio } = geometry;

  const pinionMeshRef = useRef<THREE.Group>(null);
  const gearMeshRef = useRef<THREE.Group>(null);

  // Bevel size: a small chamfer based on the module; clamped so it never collapses tiny modules.
  const chamferDist = gearInput.chamferEdges ? Math.min(1.0, gearInput.module * 0.1) : 0;

  // --- PINION GEOMETRIES ---------------------------------------------------

  const pinionGeometry = useMemo(() => {
    const pts = generateGearProfile(
      pinion.z,
      pinion.m,
      gearInput.pressureAngle,
      gearInput.x1,
      gearInput.addendumCoeff,
      gearInput.dedendumCoeff,
      geometry.deltaY,
      FLANK_POINTS,
      ROOT_POINTS
    );
    const shape = buildGearShape(pts, gearInput.bore1, gearInput.keyway1);
    if (!shape) return null;

    return new THREE.ExtrudeGeometry(shape, {
      depth: gearInput.faceWidth,
      bevelEnabled: gearInput.chamferEdges,
      bevelSegments: 2,
      steps: 1,
      bevelSize: chamferDist,
      bevelThickness: chamferDist,
    });
  }, [
    pinion.z,
    pinion.m,
    gearInput.pressureAngle,
    gearInput.x1,
    gearInput.addendumCoeff,
    gearInput.dedendumCoeff,
    gearInput.bore1,
    gearInput.keyway1,
    gearInput.faceWidth,
    gearInput.chamferEdges,
    chamferDist,
    geometry.deltaY,
  ]);
  useDisposable(pinionGeometry);

  const pinionHubGeometry = useMemo(() => {
    if (gearInput.hubD1 <= gearInput.bore1 || gearInput.hubL1 <= 0) return null;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, gearInput.hubD1 / 2, 0, Math.PI * 2, false);
    shape.holes.push(createBorePath(gearInput.bore1, gearInput.keyway1));
    return new THREE.ExtrudeGeometry(shape, {
      depth: gearInput.hubL1,
      bevelEnabled: false,
      steps: 1,
    });
  }, [gearInput.hubD1, gearInput.hubL1, gearInput.bore1, gearInput.keyway1]);
  useDisposable(pinionHubGeometry);

  const pinionShaftGeometry = useMemo(() => {
    if (gearInput.shaftL1 <= 0) return null;
    const shape = createShaftShape(gearInput.bore1, gearInput.keyway1);
    if (!shape) return null;
    return new THREE.ExtrudeGeometry(shape, {
      depth: gearInput.shaftL1,
      bevelEnabled: false,
      steps: 1,
    });
  }, [gearInput.bore1, gearInput.shaftL1, gearInput.keyway1]);
  useDisposable(pinionShaftGeometry);

  // --- GEAR GEOMETRIES -----------------------------------------------------

  const gearGeometry = useMemo(() => {
    const pts = generateGearProfile(
      gear.z,
      gear.m,
      gearInput.pressureAngle,
      gearInput.x2,
      gearInput.addendumCoeff,
      gearInput.dedendumCoeff,
      geometry.deltaY,
      FLANK_POINTS,
      ROOT_POINTS
    );
    const shape = buildGearShape(pts, gearInput.bore2, gearInput.keyway2);
    if (!shape) return null;

    return new THREE.ExtrudeGeometry(shape, {
      depth: gearInput.faceWidth,
      bevelEnabled: gearInput.chamferEdges,
      bevelSegments: 2,
      steps: 1,
      bevelSize: chamferDist,
      bevelThickness: chamferDist,
    });
  }, [
    gear.z,
    gear.m,
    gearInput.pressureAngle,
    gearInput.x2,
    gearInput.addendumCoeff,
    gearInput.dedendumCoeff,
    gearInput.bore2,
    gearInput.keyway2,
    gearInput.faceWidth,
    gearInput.chamferEdges,
    chamferDist,
    geometry.deltaY,
  ]);
  useDisposable(gearGeometry);

  const gearHubGeometry = useMemo(() => {
    if (gearInput.hubD2 <= gearInput.bore2 || gearInput.hubL2 <= 0) return null;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, gearInput.hubD2 / 2, 0, Math.PI * 2, false);
    shape.holes.push(createBorePath(gearInput.bore2, gearInput.keyway2));
    return new THREE.ExtrudeGeometry(shape, {
      depth: gearInput.hubL2,
      bevelEnabled: false,
      steps: 1,
    });
  }, [gearInput.hubD2, gearInput.hubL2, gearInput.bore2, gearInput.keyway2]);
  useDisposable(gearHubGeometry);

  const gearShaftGeometry = useMemo(() => {
    if (gearInput.shaftL2 <= 0) return null;
    const shape = createShaftShape(gearInput.bore2, gearInput.keyway2);
    if (!shape) return null;
    return new THREE.ExtrudeGeometry(shape, {
      depth: gearInput.shaftL2,
      bevelEnabled: false,
      steps: 1,
    });
  }, [gearInput.bore2, gearInput.shaftL2, gearInput.keyway2]);
  useDisposable(gearShaftGeometry);

  // Half-pitch alignment so a pinion tooth enters a gear gap on the centerline.
  const gearBaseAngle = useMemo(
    () => (gear.z % 2 === 0 ? Math.PI + Math.PI / gear.z : Math.PI),
    [gear.z]
  );

  useFrame((_state, delta) => {
    if (!isAnimating) return;
    const baseSpeedDegPerSec = 180;
    const deltaAngleRad = ((baseSpeedDegPerSec * delta * animationSpeed) * Math.PI) / 180;

    if (pinionMeshRef.current) {
      pinionMeshRef.current.rotation.z += deltaAngleRad;
    }
    if (gearMeshRef.current) {
      gearMeshRef.current.rotation.z -= deltaAngleRad / ratio;
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[60, 80, 120]} intensity={0.9} />
      <directionalLight position={[-80, -50, 60]} intensity={0.4} />

      <Center>
        {/* Pinion */}
        <group ref={pinionMeshRef} position={[0, 0, -gearInput.faceWidth / 2]}>
          {pinionGeometry && (
            <mesh geometry={pinionGeometry}>
              <meshStandardMaterial color="#22d3ee" roughness={0.25} metalness={0.75} />
            </mesh>
          )}
          {pinionHubGeometry && (
            <mesh geometry={pinionHubGeometry} position={[0, 0, gearInput.faceWidth]}>
              <meshStandardMaterial color="#0891b2" roughness={0.3} metalness={0.7} />
            </mesh>
          )}
          {pinionShaftGeometry && (
            <mesh geometry={pinionShaftGeometry} position={[0, 0, -gearInput.shaftL1 * 0.2]}>
              <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.8} />
            </mesh>
          )}
        </group>

        {/* Gear */}
        <group
          ref={gearMeshRef}
          position={[aw, 0, -gearInput.faceWidth / 2]}
          rotation={[0, 0, gearBaseAngle]}
        >
          {gearGeometry && (
            <mesh geometry={gearGeometry}>
              <meshStandardMaterial color="#e879f9" roughness={0.25} metalness={0.75} />
            </mesh>
          )}
          {gearHubGeometry && (
            <mesh geometry={gearHubGeometry} position={[0, 0, gearInput.faceWidth]}>
              <meshStandardMaterial color="#c084fc" roughness={0.3} metalness={0.7} />
            </mesh>
          )}
          {gearShaftGeometry && (
            <mesh geometry={gearShaftGeometry} position={[0, 0, -gearInput.shaftL2 * 0.2]}>
              <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.8} />
            </mesh>
          )}
        </group>
      </Center>

      <gridHelper
        args={[300, 30, '#444', '#222']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[aw / 2, 0, -gearInput.faceWidth - 1]}
      />
    </>
  );
}

export function GearMesh3DView({ result, isAnimating, animationSpeed }: GearMesh3DViewProps) {
  return (
    <div className="viewer-container">
      <div className="viewer-toolbar">
        <span className="viewer-title">3D Engaged Assembly</span>
        <span className="viewer-hint">Orbit: Left Click | Pan: Right Click | Zoom: Scroll</span>
      </div>
      <div className="canvas-wrapper" style={{ width: '100%', height: 'calc(100% - 40px)', background: '#111' }}>
        <Canvas
          camera={{ position: [0, 0, 150], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#0e0f12']} />
          <React.Suspense fallback={null}>
            <GearScene result={result} isAnimating={isAnimating} animationSpeed={animationSpeed} />
            <OrbitControls enableDamping dampingFactor={0.05} />
          </React.Suspense>
        </Canvas>
      </div>
    </div>
  );
}
