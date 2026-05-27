# 📖 Visual Gear Pair Calculator Documentation

Welcome to the technical documentation directory for the Visual Gear Pair Calculator. This directory contains detailed articles on the internal mechanisms, mathematical engine, component architecture, and CAD export integrations.

## 🗂️ Documentation Sections

### 1. [Mathematical Engine & Core Physics](./mathematics.md)
*   **Involute Curve Derivation**: How we generate discrete points for the gear teeth above the base circle, and radial profiles below it.
*   **Numerical Solvers**: Newton-Raphson approximation for operating pressure angle ($\alpha_w$) under arbitrary profile shifts.
*   **Mechanical Loads**: Calculations for tangential, radial, and normal forces.
*   ** Lewis Stress & Safety Factors**: Standard calculations for tooth bending limits.

### 2. [Application Architecture & State Flow](./architecture.md)
*   **State Store (Zustand)**: Explanation of the global `gearStore.ts` containing inputs, calculated outputs, warnings, and animation states.
*   **React Components**: Visualizer overlays, inputs panel, forces panel, and the 2D SVG canvas vs. 3D WebGL (R3F) layout.
*   **Worker Protocol**: Multithreaded message passing for heavy CAD calculations.

### 3. [Exporters & File Format Generators](./exporters.md)
*   **PDF Generation**: Layout rendering on the PDF canvas using custom involute plotting.
*   **DXF Drafting Engine**: Structure of DXF groups, layers, and exporting 2D polyline profiles.
*   **STEP Modeling Worker**: How OpenCascade JS / `replicad` initializes in a separate thread to produce solid 3D models.

---

## 🛠️ Codebase Structure

A brief overview of the source file layouts:

```text
src/
├── components/          # React components (Visualizers, control panels)
├── domain/              # Pure mathematical engines, calculators, & solvers
├── services/            # Exporter engines (PDF, DXF, Web Worker client)
├── state/               # Zustand global state store
├── tests/               # Vitest unit tests for mechanical algorithms
├── styles.css           # Glassmorphism theme styling
├── main.tsx             # Application entry point
└── App.tsx              # Dashboard layout assembly
```
