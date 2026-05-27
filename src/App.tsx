import React, { useState, useEffect, useMemo } from 'react';
import { Cog } from 'lucide-react';
import { useGearStore } from './state/gearStore';
import { calculateSpurGearPair } from './domain/gearPair';
import {
  exportSingleGearDxf,
  exportGearPairLayoutDxf,
  downloadDxfFile,
} from './services/dxfExporter';
import { generatePdfReport, downloadPdf } from './services/pdfReport';
import { buildStepInWorker, warmupCadWorker } from './services/cadWorkerClient';
import type { CadWorkerBuildKind } from './services/cad-worker-protocol';
import { Sidebar } from './components/Sidebar';
import { VisualizationPanel } from './components/VisualizationPanel';
import { ResultsPanel } from './components/ResultsPanel';

type CadProgress = { stage: string; percent: number } | null;

export default function App() {
  // Subscribe only to the slices needed for derived calculation; UI-only state
  // (animation speed, active tab, design mode) does not retrigger recomputation here.
  const metadata = useGearStore((s) => s.metadata);
  const gearInput = useGearStore((s) => s.gearInput);
  const loadInput = useGearStore((s) => s.loadInput);
  const materialInput = useGearStore((s) => s.materialInput);
  const importSession = useGearStore((s) => s.importSession);

  const result = useMemo(
    () => calculateSpurGearPair(metadata, gearInput, loadInput, materialInput),
    [metadata, gearInput, loadInput, materialInput]
  );

  const [cadProgress, setCadProgress] = useState<CadProgress>(null);
  const [cadError, setCadError] = useState<string | null>(null);
  const [pdfIncludeLayout, setPdfIncludeLayout] = useState(false);
  // Per-kind STEP cache keyed by `${kind}:${inputsHash}`.
  const [stepCache, setStepCache] = useState<Map<string, ArrayBuffer>>(() => new Map());

  // Pre-warm the OpenCascade workers so the first STEP export doesn't pay boot cost.
  useEffect(() => {
    warmupCadWorker().catch((err) => console.warn('CAD worker warmup failed:', err));
  }, []);

  // --- File-name helpers -------------------------------------------------

  const metadataFilename = (type: string) => {
    const proj = metadata.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `${proj}_gear_${type}`;
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Exports -----------------------------------------------------------

  const handleExportPdf = () => {
    const blob = generatePdfReport(result, pdfIncludeLayout);
    downloadPdf(`${metadataFilename('report')}.pdf`, blob);
  };

  const handleExportDxf = (mode: 'pinion' | 'gear' | 'layout') => {
    const { geometry } = result;
    if (mode === 'pinion') {
      const dxf = exportSingleGearDxf(
        geometry.pinion.z,
        geometry.pinion.m,
        gearInput.pressureAngle,
        gearInput.x1,
        gearInput.addendumCoeff,
        gearInput.dedendumCoeff,
        geometry.deltaY,
        gearInput.bore1,
        'Pinion (Pinion-Side)'
      );
      downloadDxfFile(`${metadataFilename('pinion')}.dxf`, dxf);
    } else if (mode === 'gear') {
      const dxf = exportSingleGearDxf(
        geometry.gear.z,
        geometry.gear.m,
        gearInput.pressureAngle,
        gearInput.x2,
        gearInput.addendumCoeff,
        gearInput.dedendumCoeff,
        geometry.deltaY,
        gearInput.bore2,
        'Gear (Wheel-Side)'
      );
      downloadDxfFile(`${metadataFilename('gear')}.dxf`, dxf);
    } else {
      const dxf = exportGearPairLayoutDxf(result);
      downloadDxfFile(`${metadataFilename('assembly_layout')}.dxf`, dxf);
    }
  };

  const stepCacheKey = (kind: CadWorkerBuildKind) =>
    `${kind}:${JSON.stringify(gearInput)}`;

  const handleExportStep = async (kind: CadWorkerBuildKind) => {
    setCadError(null);
    const key = stepCacheKey(kind);

    const cached = stepCache.get(key);
    if (cached) {
      const blob = new Blob([cached], { type: 'application/step' });
      downloadBlob(blob, `${metadataFilename(kind)}.step`);
      return;
    }

    try {
      setCadProgress({ stage: 'Starting openCASCADE kernel...', percent: 5 });
      const buffer = await buildStepInWorker(kind, gearInput, result.geometry.deltaY, result.geometry.aw, {
        onProgress: (msg) => {
          let stage = '';
          let percent = 10;
          if (msg.stage === 'init') {
            stage = 'Initializing OpenCascade...';
            percent = 15;
          } else if (msg.stage === 'profile') {
            stage = 'Generating tooth profile...';
            percent = 30;
          } else if (msg.stage === 'solid') {
            stage = kind === 'assembly' ? 'Modeling both solids...' : `Modeling ${kind} solid...`;
            percent = 60;
          } else if (msg.stage === 'compound') {
            stage = 'Engaging gear meshes...';
            percent = 80;
          } else if (msg.stage === 'export') {
            stage = 'Writing STEP file...';
            percent = 92;
          }
          setCadProgress({ stage, percent });
        },
      });

      setCadProgress({ stage: 'Downloading...', percent: 100 });
      setStepCache((prev) => {
        const next = new Map(prev);
        next.set(key, buffer);
        return next;
      });

      const blob = new Blob([buffer], { type: 'application/step' });
      downloadBlob(blob, `${metadataFilename(kind)}.step`);
      setTimeout(() => setCadProgress(null), 800);
    } catch (err: any) {
      console.error(err);
      setCadError(err.message || String(err));
      setCadProgress(null);
    }
  };

  const handleExportSession = () => {
    const session = {
      version: 1,
      metadata,
      gearInput,
      loadInput,
      materialInput,
    };
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${metadataFilename('session')}.json`);
  };

  const handleImportSession = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.gearInput || !parsed.loadInput || !parsed.materialInput) {
        throw new Error('Invalid session structure. Check gear parameters, loads, or materials.');
      }

      importSession({
        metadata: parsed.metadata || metadata,
        gearInput: parsed.gearInput,
        loadInput: parsed.loadInput,
        materialInput: parsed.materialInput,
      });
      setCadError(null);
    } catch (err: any) {
      console.error(err);
      alert(`Session import failed: ${err.message || err}`);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <Cog className="header-logo" size={24} />
          <h1>Visual Gear Pair Calculator</h1>
        </div>
      </header>

      <div className="app-workspace">
        <Sidebar
          result={result}
          cadError={cadError}
          pdfIncludeLayout={pdfIncludeLayout}
          setPdfIncludeLayout={setPdfIncludeLayout}
          onExportPdf={handleExportPdf}
          onExportDxf={handleExportDxf}
          onExportStep={handleExportStep}
          onExportSession={handleExportSession}
          onImportSession={handleImportSession}
        />

        <main className="main-view">
          <VisualizationPanel result={result} cadProgress={cadProgress} />
          <ResultsPanel result={result} />
        </main>
      </div>
    </div>
  );
}
