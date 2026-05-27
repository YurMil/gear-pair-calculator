# 📤 Exporters & File Format Generators

The Visual Gear Pair Calculator supports three high-fidelity exporter modules: PDF, DXF, and STEP. All file processing is performed client-side without sending any data to remote servers.

---

## 1. PDF Report Generator (`src/services/pdfReport.ts`)

The PDF export uses the `jspdf` library to generate a comprehensive 2-3 page sizing datasheet.

### Document Structure
1.  **Header**: Project title, metadata, materials, and date.
2.  **Geometry Section**: Module, teeth count, pressure angles, pitch/tip/root diameters, profile shifts, center distance, and contact ratio.
3.  **Mechanical Analysis**: Torque, rotational speed, tangential force, radial force, bending stress, and the calculated safety factor.
4.  **2D Engagement Layout Drawing**:
    *   If the "Layout in PDF" option is enabled in the UI, a standalone page is appended to the PDF.
    *   The engine calculates the tooth points using `generateGearProfile()` and draws them onto the PDF vector coordinate canvas using native PDF stroke and fill operations.
    *   This provides a visual drawing of the engaged pair in vector format (zoomable without loss of quality).

---

## 2. DXF Vector Exporter (`src/services/dxfExporter.ts`)

To support profile cutting (laser cutting, waterjet, or wire EDM) and import into 2D CAD packages (like AutoCAD), the app outputs `.dxf` drawing files.

### Implementation Features
*   **Format**: The module compiles a string using the standard DXF format (using codes like `0`, `SECTION`, `HEADER`, `TABLES`, `BLOCKS`, and `ENTITIES`).
*   **Layers**: Elements are separated into discrete layers:
    *   `GEAR_PROFILE`: Pinion and gear involute teeth curves.
    *   `PITCH_CIRCLES`: Reference pitch lines for checking contact alignment.
    *   `BORES`: Pinion and gear center shaft boundaries.
*   **Output Modes**: The user can export:
    *   Only the **Pinion** profile centered at `(0,0)`.
    *   Only the **Gear** profile centered at `(0,0)`.
    *   The **Combined Assembly** spaced at the exact operating center distance $a_w$.

---

## 3. Solid 3D STEP Exporter (`src/services/cad-worker.ts`)

For integration into 3D CAD platforms (SolidWorks, Inventor, Fusion360), the app exports solid boundary representations (B-Rep) via the STEP format.

### Replicad & OpenCascade
*   The exporter uses **Replicad**, a lightweight TS/JS library that compiles **OpenCascade (OCCT)** (the standard open-source C++ CAD kernel) into WebAssembly.
*   The modeling steps executed inside the background worker thread:
    1.  Create a 2D wireframe shape of a single tooth profile using base/root/pitch coordinates.
    2.  Rotate the profile to form a full 2D gear face shape.
    3.  Extrude the 2D shape along the Z-axis to the specified **Face Width**.
    4.  Create a cylinder representing the shaft bore and perform a boolean **Subtraction** (Cut) to add the center mounting bore.
    5.  Compile the resulting solid shape into a STEP text file using OpenCascade's STEP writer.
    6.  Transfer the string back to the main UI thread as a downloadable blob.
