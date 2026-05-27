import React, { useRef } from 'react';
import { Download, Search } from 'lucide-react';
import { useGearStore } from '../state/gearStore';
import { MATERIAL_PRESETS } from '../domain/gearPair';
import type { CalculationResult, ValidationIssue } from '../domain/types';

type ExportDxfMode = 'pinion' | 'gear' | 'layout';
type ExportStepKind = 'pinion' | 'gear' | 'assembly';

interface SidebarProps {
  result: CalculationResult;
  cadError: string | null;
  pdfIncludeLayout: boolean;
  setPdfIncludeLayout: (v: boolean) => void;
  onExportPdf: () => void;
  onExportDxf: (mode: ExportDxfMode) => void;
  onExportStep: (kind: ExportStepKind) => void;
  onExportSession: () => void;
  onImportSession: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const hasIssue = (issues: ValidationIssue[], id: string) => issues.some((i) => i.id === id);

export function Sidebar(props: SidebarProps) {
  const {
    result,
    cadError,
    pdfIncludeLayout,
    setPdfIncludeLayout,
    onExportPdf,
    onExportDxf,
    onExportStep,
    onExportSession,
    onImportSession,
  } = props;

  const numErrors = result.issues.filter((i) => i.severity === 'error').length;

  return (
    <aside className="sidebar-panel">
      <ModeToggle />
      <ProjectInfoSection />
      <GearParametersSection />
      <LoadsMaterialsSection />
      <BodyProfilesSection issues={result.issues} />
      <ExportSection
        cadError={cadError}
        numErrors={numErrors}
        pdfIncludeLayout={pdfIncludeLayout}
        setPdfIncludeLayout={setPdfIncludeLayout}
        onExportPdf={onExportPdf}
        onExportDxf={onExportDxf}
        onExportStep={onExportStep}
        onExportSession={onExportSession}
        onImportSession={onImportSession}
      />
    </aside>
  );
}

// --- Mode toggle (Check / Ratio Proposals) ---------------------------------

function ModeToggle() {
  const designMode = useGearStore((s) => s.designMode);
  const setDesignMode = useGearStore((s) => s.setDesignMode);
  const setActiveTab = useGearStore((s) => s.setActiveTab);
  const runRatioSearch = useGearStore((s) => s.runRatioSearch);

  return (
    <div className="panel-section" style={{ border: 'none', background: 'transparent' }}>
      <div className="btn-group" style={{ width: '100%' }}>
        <button
          className={`btn ${designMode === 'check' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => {
            setDesignMode('check');
            setActiveTab('dimensions');
          }}
        >
          Gear Pair Check
        </button>
        <button
          className={`btn ${designMode === 'ratio' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => {
            setDesignMode('ratio');
            setActiveTab('ratioSearch');
            runRatioSearch();
          }}
        >
          Ratio Proposals
        </button>
      </div>
    </div>
  );
}

// --- Project info ----------------------------------------------------------

function ProjectInfoSection() {
  const metadata = useGearStore((s) => s.metadata);
  const setMetadata = useGearStore((s) => s.setMetadata);

  return (
    <div className="panel-section">
      <div className="section-header">Project Context</div>
      <div className="section-content">
        <div className="form-group">
          <label className="form-label">Project Title</label>
          <input
            type="text"
            className="form-input"
            value={metadata.projectName}
            onChange={(e) => setMetadata({ projectName: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Pinion Part No.</label>
            <input
              type="text"
              className="form-input"
              value={metadata.pinionPartNum}
              onChange={(e) => setMetadata({ pinionPartNum: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Gear Part No.</label>
            <input
              type="text"
              className="form-input"
              value={metadata.gearPartNum}
              onChange={(e) => setMetadata({ gearPartNum: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Gear parameters -------------------------------------------------------

function GearParametersSection() {
  const gearInput = useGearStore((s) => s.gearInput);
  const setGearInput = useGearStore((s) => s.setGearInput);

  return (
    <div className="panel-section">
      <div className="section-header">Gear Parameters</div>
      <div className="section-content">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Module <span className="label-symbol">m</span>
            </label>
            <div className="form-input-container">
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={gearInput.module}
                onChange={(e) => setGearInput({ module: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
              />
              <span className="input-unit">mm</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Pressure Angle</label>
            <select
              className="form-select"
              value={gearInput.pressureAngle}
              onChange={(e) => setGearInput({ pressureAngle: parseFloat(e.target.value) })}
            >
              <option value="14.5">14.5° Full depth</option>
              <option value="20">20.0° Standard</option>
              <option value="25">25.0° High strength</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Pinion Teeth <span className="label-symbol">z1</span>
            </label>
            <input
              type="number"
              className="form-input"
              value={gearInput.z1}
              onChange={(e) => setGearInput({ z1: Math.max(4, parseInt(e.target.value) || 4) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Gear Teeth <span className="label-symbol">z2</span>
            </label>
            <input
              type="number"
              className="form-input"
              value={gearInput.z2}
              onChange={(e) => setGearInput({ z2: Math.max(4, parseInt(e.target.value) || 4) })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Pinion Shift <span className="label-symbol">x1</span>
            </label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={gearInput.x1}
              onChange={(e) => setGearInput({ x1: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Gear Shift <span className="label-symbol">x2</span>
            </label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={gearInput.x2}
              onChange={(e) => setGearInput({ x2: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Face Width <span className="label-symbol">b</span>
            </label>
            <div className="form-input-container">
              <input
                type="number"
                className="form-input"
                value={gearInput.faceWidth}
                onChange={(e) => setGearInput({ faceWidth: Math.max(1, parseFloat(e.target.value) || 1) })}
              />
              <span className="input-unit">mm</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Backlash</label>
            <div className="form-input-container">
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={gearInput.backlash}
                onChange={(e) => setGearInput({ backlash: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
              <span className="input-unit">mm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Loads & materials -----------------------------------------------------

function LoadsMaterialsSection() {
  const loadInput = useGearStore((s) => s.loadInput);
  const setLoadInput = useGearStore((s) => s.setLoadInput);
  const materialInput = useGearStore((s) => s.materialInput);
  const setMaterialInput = useGearStore((s) => s.setMaterialInput);

  return (
    <div className="panel-section">
      <div className="section-header">Loads & Materials</div>
      <div className="section-content">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Pinion Speed <span className="label-symbol">n1</span>
            </label>
            <div className="form-input-container">
              <input
                type="number"
                className="form-input"
                value={loadInput.speed1}
                onChange={(e) => setLoadInput({ speed1: Math.max(1, parseFloat(e.target.value) || 1) })}
              />
              <span className="input-unit">RPM</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Torque <span className="label-symbol">T1</span>
            </label>
            <div className="form-input-container">
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={loadInput.torque1}
                onChange={(e) => setLoadInput({ torque1: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
              />
              <span className="input-unit">N*m</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Gear Material Preset</label>
          <select
            className="form-select"
            value={materialInput.material1}
            onChange={(e) => {
              const preset = MATERIAL_PRESETS.find((p) => p.name === e.target.value);
              if (preset) {
                setMaterialInput({
                  material1: preset.name,
                  material2: preset.name,
                  allowableBending1: preset.allowableBending,
                  allowableBending2: preset.allowableBending,
                  density1: preset.density,
                  density2: preset.density,
                });
              }
            }}
          >
            {MATERIAL_PRESETS.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// --- CAD body profiles -----------------------------------------------------

function BodyProfilesSection({ issues }: { issues: ValidationIssue[] }) {
  const gearInput = useGearStore((s) => s.gearInput);
  const setGearInput = useGearStore((s) => s.setGearInput);

  return (
    <div className="panel-section">
      <div className="section-header">CAD Body Profiles</div>
      <div className="section-content">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Pinion Bore</label>
            <div className="form-input-container">
              <input
                type="number"
                className={`form-input ${hasIssue(issues, 'bore-large-pinion') ? 'error' : ''}`}
                value={gearInput.bore1}
                onChange={(e) => setGearInput({ bore1: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
              <span className="input-unit">mm</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gear Bore</label>
            <div className="form-input-container">
              <input
                type="number"
                className={`form-input ${hasIssue(issues, 'bore-large-gear') ? 'error' : ''}`}
                value={gearInput.bore2}
                onChange={(e) => setGearInput({ bore2: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
              <span className="input-unit">mm</span>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Pinion Hub (D x L)</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                className="form-input"
                placeholder="Dia"
                value={gearInput.hubD1}
                onChange={(e) => setGearInput({ hubD1: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
              <input
                type="number"
                className="form-input"
                placeholder="Len"
                value={gearInput.hubL1}
                onChange={(e) => setGearInput({ hubL1: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gear Hub (D x L)</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                className="form-input"
                placeholder="Dia"
                value={gearInput.hubD2}
                onChange={(e) => setGearInput({ hubD2: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
              <input
                type="number"
                className="form-input"
                placeholder="Len"
                value={gearInput.hubL2}
                onChange={(e) => setGearInput({ hubL2: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Pinion Shaft Len</label>
            <div className="form-input-container">
              <input
                type="number"
                className="form-input"
                value={gearInput.shaftL1}
                onChange={(e) => setGearInput({ shaftL1: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
              <span className="input-unit">mm</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gear Shaft Len</label>
            <div className="form-input-container">
              <input
                type="number"
                className="form-input"
                value={gearInput.shaftL2}
                onChange={(e) => setGearInput({ shaftL2: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
              <span className="input-unit">mm</span>
            </div>
          </div>
        </div>

        <div className="form-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={gearInput.keyway1}
              onChange={(e) => setGearInput({ keyway1: e.target.checked })}
            />
            Pinion Keyway
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={gearInput.keyway2}
              onChange={(e) => setGearInput({ keyway2: e.target.checked })}
            />
            Gear Keyway
          </label>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={gearInput.chamferEdges}
              onChange={(e) => setGearInput({ chamferEdges: e.target.checked })}
            />
            Apply Edge Chamfers to Teeth
          </label>
        </div>
      </div>
    </div>
  );
}

// --- Exports ---------------------------------------------------------------

interface ExportSectionProps {
  cadError: string | null;
  numErrors: number;
  pdfIncludeLayout: boolean;
  setPdfIncludeLayout: (v: boolean) => void;
  onExportPdf: () => void;
  onExportDxf: (mode: ExportDxfMode) => void;
  onExportStep: (kind: ExportStepKind) => void;
  onExportSession: () => void;
  onImportSession: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function ExportSection({
  cadError,
  numErrors,
  pdfIncludeLayout,
  setPdfIncludeLayout,
  onExportPdf,
  onExportDxf,
  onExportStep,
  onExportSession,
  onImportSession,
}: ExportSectionProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="panel-section">
      <div className="section-header">Export & CAD Models</div>
      <div className="section-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* PDF Reports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={subHeaderStyle}>Documentation</div>
          <button
            className="btn btn-secondary"
            onClick={onExportPdf}
            style={{ width: '100%', justifyContent: 'center', height: '36px' }}
          >
            <Download size={14} style={{ marginRight: '6px' }} /> PDF Report
          </button>
          <label
            className="checkbox-label"
            style={{
              fontSize: '11px',
              margin: '4px 0 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={pdfIncludeLayout}
              onChange={(e) => setPdfIncludeLayout(e.target.checked)}
            />
            Include Layout drawing in PDF
          </label>
        </div>

        {/* 2D Drawings */}
        <div style={dividerStyle}>
          <div style={subHeaderStyle}>2D CAD Drawings (.dxf)</div>
          <button
            className="btn btn-secondary"
            onClick={() => onExportDxf('layout')}
            style={{ width: '100%', justifyContent: 'center', height: '32px', fontSize: '12px' }}
          >
            <Download size={12} style={{ marginRight: '6px' }} /> DXF Engaged Layout
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => onExportDxf('pinion')}
              style={{ justifyContent: 'center', height: '32px', fontSize: '12px' }}
            >
              Pinion DXF
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onExportDxf('gear')}
              style={{ justifyContent: 'center', height: '32px', fontSize: '12px' }}
            >
              Gear DXF
            </button>
          </div>
        </div>

        {/* 3D STEP Models */}
        <div style={dividerStyle}>
          <div style={subHeaderStyle}>3D CAD STEP Models (.step)</div>
          <button
            className="btn btn-primary"
            onClick={() => onExportStep('assembly')}
            disabled={numErrors > 0}
            style={{ width: '100%', justifyContent: 'center', height: '36px' }}
          >
            <Download size={14} style={{ marginRight: '6px' }} /> Download Assembly STEP
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => onExportStep('pinion')}
              disabled={numErrors > 0}
              style={{ justifyContent: 'center', height: '32px', fontSize: '12px' }}
            >
              Pinion STEP
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onExportStep('gear')}
              disabled={numErrors > 0}
              style={{ justifyContent: 'center', height: '32px', fontSize: '12px' }}
            >
              Gear STEP
            </button>
          </div>
        </div>

        {/* Session */}
        <div style={dividerStyle}>
          <div style={subHeaderStyle}>Session Storage</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={onExportSession}
              style={{ justifyContent: 'center', height: '32px', fontSize: '12px' }}
            >
              Save Session
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => importInputRef.current?.click()}
              style={{ justifyContent: 'center', height: '32px', fontSize: '12px' }}
            >
              Load Session
            </button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={onImportSession}
          />
        </div>

        {cadError && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--accent-magenta)',
              padding: '6px',
              background: 'rgba(232, 121, 249, 0.1)',
              borderRadius: '4px',
              border: '1px solid rgba(232, 121, 249, 0.2)',
              marginTop: '4px',
            }}
          >
            STEP failed: {cadError}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline style helpers — small, local to this file to avoid CSS churn.
const subHeaderStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  paddingTop: '10px',
  borderTop: '1px solid var(--border-color)',
};
