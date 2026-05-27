# 🏗️ Application Architecture & State Flow

The Visual Gear Pair Calculator is structured as a client-side Single Page Application (SPA). All math, rendering, and CAD model generation occur locally in the user's browser.

---

## 1. Directory Structure

The code is organized into decoupled layers:

```text
src/
├── state/
│   └── gearStore.ts            # Core state machine (Zustand)
├── domain/
│   ├── types.ts                # TypeScript interfaces
│   ├── spurGeometry.ts         # Math engine for sizing
│   ├── involute.ts             # Profile coordinates generator
│   ├── forces.ts               # Load solver
│   ├── preliminaryStrength.ts  # Lewis stress equations
│   ├── ratioSearch.ts          # Module/teeth combinations solver
│   └── validation.ts           # Design warning checkers
├── components/
│   ├── GearMesh2DView.tsx      # SVG interactive canvas
│   └── GearMesh3DView.tsx      # Three.js / React Three Fiber visualizer
└── App.tsx                     # Main page dashboard assembly
```

---

## 2. Core State Management: Zustand

The entire application relies on a single store (`src/state/gearStore.ts`). 
Zustand is chosen for its lightweight footprint and high performance, preventing unnecessary React re-renders during fast slider drag actions.

### State Store Structure
*   **Inputs**: Module, tooth counts ($z_1, z_2$), face width, pressure angle, profile shifts ($x_1, x_2$), center distance adjustment, power, speed, yield strength, material choice.
*   **Derived Outputs**: Automatically recalculated on any input change.
    *   Pitch/base/tip/root diameters.
    *   Operating pressure angle and center distance.
    *   Mechanical torque, forces ($F_t, F_r, F_n$), bending stresses, and safety factors.
    *   Warning messages (undercutting, low contact ratio, overlapping diameters).
*   **UI Control State**: Play/pause animation toggles, animation speed multiplier, visual modes (2D vs. 3D), and PDF layout include flags.

---

## 3. Component Details & Visualizer Engines

### 2D Engagement Visualizer (`GearMesh2DView.tsx`)
*   Uses a raw `<svg>` canvas with custom matrix transforms.
*   Features mouse/touch pan and zoom handlers using raw delta coordinates.
*   Renders full gear teeth shapes by querying `generateGearProfile()` from the math engine.
*   Uses a `requestAnimationFrame` hook to increment the gear mesh rotation angle in state.

### 3D Visualizer (`GearMesh3DView.tsx`)
*   Uses `@react-three/fiber` (R3F) and `@react-three/drei`.
*   Converts the 2D involute points array into a `THREE.Shape`.
*   Uses `<extrudeGeometry>` to extrude the shape to the design's **Face Width**.
*   Renders separate mesh nodes for Pinion, Gear, and Shaft bores.
*   Binds animation frames directly to the mesh `rotation.z` parameters for low overhead rendering.

---

## 4. Web Worker Threading

Calculating solid 3D geometries and compiling them into industrial standard formats (like `.stp`) is highly CPU-intensive and can lock the main UI thread. 

To solve this, the application delegates the task to a background worker:
1.  `src/services/cadWorkerClient.ts` launches `src/services/cad-worker.ts` as a native browser `Worker`.
2.  The worker loads `replicad` (a wrapper around **OpenCascade.js** compiled to WebAssembly).
3.  When the user clicks "Export STEP", the worker receives a postMessage with the current gear parameters.
4.  It reconstructs the gears, performs CSG operations (cutting shaft bores, creating keyways), exports the solid model as a STEP file blob, and passes it back to the UI for download.
