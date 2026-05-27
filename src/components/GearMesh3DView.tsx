import React, { useMemo, useRef } from 'react';
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

// Separate component for the actual 3D Scene to use frame loops
function GearScene({ result, isAnimating, animationSpeed }: GearMesh3DViewProps) {
  const { geometry, gearInput, loadInput } = result;
  const { pinion, gear, aw, ratio } = geometry;

  const pinionMeshRef = useRef<THREE.Group>(null);
  const gearMeshRef = useRef<THREE.Group>(null);

  // Generate 3D geometries using Three.js ExtrudeGeometry
  const pinionGeometry = useMemo(() => {
    const pts = generateGearProfile(
      pinion.z,
      pinion.m,
      gearInput.pressureAngle,
      gearInput.x1,
      gearInput.addendumCoeff,
      gearInput.dedendumCoeff,
      geometry.deltaY,
      12,
      4
    );

    const shape = new THREE.Shape();
    if (pts.length > 0) {
      shape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i].x, pts[i].y);
      }
      shape.closePath();

      // Cut out the bore
      const borePath = new THREE.Path();
      borePath.absarc(0, 0, gearInput.bore1 / 2, 0, Math.PI * 2, true);
      shape.holes.push(borePath);
    }

    const extrudeSettings = {
      depth: gearInput.faceWidth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.2,
      bevelThickness: 0.2,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [pinion.z, pinion.m, gearInput.pressureAngle, gearInput.x1, gearInput.addendumCoeff, gearInput.dedendumCoeff, gearInput.bore1, gearInput.faceWidth, geometry.deltaY]);

  const gearGeometry = useMemo(() => {
    const pts = generateGearProfile(
      gear.z,
      gear.m,
      gearInput.pressureAngle,
      gearInput.x2,
      gearInput.addendumCoeff,
      gearInput.dedendumCoeff,
      geometry.deltaY,
      12,
      4
    );

    const shape = new THREE.Shape();
    if (pts.length > 0) {
      shape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i].x, pts[i].y);
      }
      shape.closePath();

      // Cut out the bore
      const borePath = new THREE.Path();
      borePath.absarc(0, 0, gearInput.bore2 / 2, 0, Math.PI * 2, true);
      shape.holes.push(borePath);
    }

    const extrudeSettings = {
      depth: gearInput.faceWidth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.2,
      bevelThickness: 0.2,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [gear.z, gear.m, gearInput.pressureAngle, gearInput.x2, gearInput.addendumCoeff, gearInput.dedendumCoeff, gearInput.bore2, gearInput.faceWidth, geometry.deltaY]);

  // Base angles for meshing engagement
  const gearBaseAngle = useMemo(() => {
    return gear.z % 2 === 0 ? Math.PI + Math.PI / gear.z : Math.PI;
  }, [gear.z]);

  // Frame animation loop
  useFrame((state, delta) => {
    if (!isAnimating) return;

    // speed in degrees per sec
    const speedDegPerSec = loadInput.speed1 * 6;
    const deltaAngleDeg = speedDegPerSec * delta * animationSpeed;
    const deltaAngleRad = (deltaAngleDeg * Math.PI) / 180;

    if (pinionMeshRef.current) {
      pinionMeshRef.current.rotation.z += deltaAngleRad;
    }
    
    if (gearMeshRef.current) {
      // Rotate opposite direction scaled by ratio
      gearMeshRef.current.rotation.z -= deltaAngleRad / ratio;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={1.2} castShadow />
      <pointLight position={[-100, -100, 50]} intensity={0.6} />
      <directionalLight position={[0, 10, 5]} intensity={0.8} />

      <Center>
        {/* Pinion Group */}
        <group ref={pinionMeshRef} position={[0, 0, -gearInput.faceWidth / 2]}>
          <mesh geometry={pinionGeometry}>
            <meshStandardMaterial
              color="#22d3ee"
              roughness={0.2}
              metalness={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* Gear Group */}
        <group
          ref={gearMeshRef}
          position={[aw, 0, -gearInput.faceWidth / 2]}
          rotation={[0, 0, gearBaseAngle]}
        >
          <mesh geometry={gearGeometry}>
            <meshStandardMaterial
              color="#e879f9"
              roughness={0.2}
              metalness={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </Center>

      <gridHelper args={[300, 30, '#444', '#222']} rotation={[Math.PI / 2, 0, 0]} position={[aw / 2, 0, -gearInput.faceWidth - 1]} />
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
          shadows
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
