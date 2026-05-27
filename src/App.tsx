import React, { useState, useEffect } from 'react';
import { useGearStore } from './state/gearStore';
import { GearMesh2DView } from './components/GearMesh2DView';
import { GearMesh3DView } from './components/GearMesh3DView';
import { MATERIAL_PRESETS } from './domain/gearPair';
import { generateGearProfile } from './domain/involute';
import {
  exportSingleGearDxf,
  exportGearPairLayoutDxf,
  downloadDxfFile
} from './services/dxfExporter';
import { generatePdfReport, downloadPdf } from './services/pdfReport';
import { generateStepInWorker, warmupCadWorker } from './services/cadWorkerClient';
import {
  Play,
  Pause,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Download,
  Settings,
  Cog,
  Search,
  ListFilter
} from 'lucide-react';

export default function App() {
  const store = useGearStore();
  const result = store.getCalculatedResult();
  const { geometry, gearInput, loadInput, materialInput, forces, strength, issues } = result;

  // Local UI states
  const [designMode, setDesignMode] = useState<'check' | 'ratio'>('check');
  const [cadProgress, setCadProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [pdfIncludeLayout, setPdfIncludeLayout] = useState(false);

  // Warm up CAD OpenCascade worker on load to speed up exports
  useEffect(() => {
    warmupCadWorker().catch((err) => console.warn('CAD Worker warmup failed:', err));
  }, []);

  const handleExportPdf = () => {
    const blob = generatePdfReport(result, pdfIncludeLayout);
    downloadPdf(`${metadataFilename('report')}.pdf`, blob);
  };

  const metadataFilename = (type: string) => {
    const proj = result.metadata.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `${proj}_gear_${type}`;
  };

  const handleExportDxf = (mode: 'pinion' | 'gear' | 'layout') => {
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

  const handleExportStep = async () => {
    try {
      setCadProgress({ stage: 'Starting openCASCADE kernel...', percent: 10 });
      
      // Generate the tooth profile points for the worker
      const pPoints = generateGearProfile(
        geometry.pinion.z,
        geometry.pinion.m,
        gearInput.pressureAngle,
        gearInput.x1,
        gearInput.addendumCoeff,
        gearInput.dedendumCoeff,
        geometry.deltaY,
        24, // High tolerance for STEP exports
        6
      );

      const gPoints = generateGearProfile(
        geometry.gear.z,
        geometry.gear.m,
        gearInput.pressureAngle,
        gearInput.x2,
        gearInput.addendumCoeff,
        gearInput.dedendumCoeff,
        geometry.deltaY,
        24,
        6
      );

      const response = await generateStepInWorker(
        gearInput,
        pPoints,
        gPoints,
        geometry.aw,
        {
          onProgress: (msg) => {
            let percentage = 20;
            let displayStage = '';
            if (msg.stage === 'init') {
              displayStage = 'Initializing OpenCascade...';
              percentage = 30;
            } else if (msg.stage === 'pinion') {
              displayStage = 'Modeling Pinion 3D Solid...';
              percentage = 50;
            } else if (msg.stage === 'gear') {
              displayStage = 'Modeling Gear 3D Solid...';
              percentage = 70;
            } else if (msg.stage === 'assembly') {
              displayStage = 'Engaging gear meshes...';
              percentage = 85;
            } else if (msg.stage === 'export') {
              displayStage = 'Compiling STEP structures...';
              percentage = 95;
            }
            setCadProgress({ stage: displayStage, percent: percentage });
          },
        }
      );

      // Trigger downloads
      setCadProgress({ stage: 'Downloading files...', percent: 100 });
      
      const pBlob = new Blob([response.pinionStep], { type: 'application/step' });
      downloadBlob(pBlob, `${metadataFilename('pinion')}.step`);

      const gBlob = new Blob([response.gearStep], { type: 'application/step' });
      downloadBlob(gBlob, `${metadataFilename('gear')}.step`);

      const aBlob = new Blob([response.assemblyStep], { type: 'application/step' });
      downloadBlob(aBlob, `${metadataFilename('assembly')}.step`);

      setTimeout(() => setCadProgress(null), 1000);
    } catch (err: any) {
      console.error(err);
      alert(`STEP modeling failed: ${err.message || err}`);
      setCadProgress(null);
    }
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

  const numErrors = issues.filter(i => i.severity === 'error').length;
  const numWarnings = issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <Cog className="header-logo" size={24} />
          <h1>Visual Gear Pair Calculator</h1>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label className="checkbox-label" style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              checked={pdfIncludeLayout} 
              onChange={e => setPdfIncludeLayout(e.target.checked)} 
            />
            Layout in PDF
          </label>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={handleExportPdf}>
              <Download size={14} /> PDF Report
            </button>
            <button className="btn btn-secondary" onClick={() => handleExportDxf('layout')}>
              <Download size={14} /> DXF Layout
            </button>
            <button className="btn btn-secondary" onClick={() => handleExportDxf('pinion')}>
              DXF Pinion
            </button>
            <button className="btn btn-secondary" onClick={() => handleExportDxf('gear')}>
              DXF Gear
            </button>
            <button className="btn btn-primary" onClick={handleExportStep} disabled={numErrors > 0}>
              <Download size={14} /> Export 3D STEP
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="app-workspace">
        {/* Left Side Inputs Sidebar */}
        <aside className="sidebar-panel">
          {/* Sizing Mode selection */}
          <div className="panel-section" style={{ border: 'none', background: 'transparent' }}>
            <div className="btn-group" style={{ width: '100%' }}>
              <button
                className={`btn ${designMode === 'check' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => {
                  setDesignMode('check');
                  store.setActiveTab('dimensions');
                }}
              >
                Gear Pair Check
              </button>
              <button
                className={`btn ${designMode === 'ratio' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => {
                  setDesignMode('ratio');
                  store.setActiveTab('ratioSearch');
                  store.runRatioSearch();
                }}
              >
                Ratio Proposals
              </button>
            </div>
          </div>

          {/* Project Info Section */}
          <div className="panel-section">
            <div className="section-header">Project Context</div>
            <div className="section-content">
              <div className="form-group">
                <label className="form-label">Project Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={store.metadata.projectName}
                  onChange={(e) => store.setMetadata({ projectName: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Pinion Part No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={store.metadata.pinionPartNum}
                    onChange={(e) => store.setMetadata({ pinionPartNum: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gear Part No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={store.metadata.gearPartNum}
                    onChange={(e) => store.setMetadata({ gearPartNum: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Gear Geometry Section */}
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
                      onChange={(e) => store.setGearInput({ module: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                    />
                    <span className="input-unit">mm</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Pressure Angle</label>
                  <select
                    className="form-select"
                    value={gearInput.pressureAngle}
                    onChange={(e) => store.setGearInput({ pressureAngle: parseFloat(e.target.value) })}
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
                    onChange={(e) => store.setGearInput({ z1: Math.max(4, parseInt(e.target.value) || 4) })}
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
                    onChange={(e) => store.setGearInput({ z2: Math.max(4, parseInt(e.target.value) || 4) })}
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
                    onChange={(e) => store.setGearInput({ x1: parseFloat(e.target.value) || 0 })}
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
                    onChange={(e) => store.setGearInput({ x2: parseFloat(e.target.value) || 0 })}
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
                      onChange={(e) => store.setGearInput({ faceWidth: Math.max(1, parseFloat(e.target.value) || 1) })}
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
                      onChange={(e) => store.setGearInput({ backlash: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                    <span className="input-unit">mm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Load and Materials */}
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
                      onChange={(e) => store.setLoadInput({ speed1: Math.max(1, parseFloat(e.target.value) || 1) })}
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
                      onChange={(e) => store.setLoadInput({ torque1: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
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
                    const preset = MATERIAL_PRESETS.find(p => p.name === e.target.value);
                    if (preset) {
                      store.setMaterialInput({
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

          {/* Hub & Bore body options */}
          <div className="panel-section">
            <div className="section-header">CAD Body Profiles</div>
            <div className="section-content">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Pinion Bore</label>
                  <div className="form-input-container">
                    <input
                      type="number"
                      className={`form-input ${issues.some(i => i.id === 'bore-large-pinion') ? 'error' : ''}`}
                      value={gearInput.bore1}
                      onChange={(e) => store.setGearInput({ bore1: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                    <span className="input-unit">mm</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Gear Bore</label>
                  <div className="form-input-container">
                    <input
                      type="number"
                      className={`form-input ${issues.some(i => i.id === 'bore-large-gear') ? 'error' : ''}`}
                      value={gearInput.bore2}
                      onChange={(e) => store.setGearInput({ bore2: Math.max(0, parseFloat(e.target.value) || 0) })}
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
                    onChange={(e) => store.setGearInput({ keyway1: e.target.checked })}
                  />
                  Pinion Keyway
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={gearInput.keyway2}
                    onChange={(e) => store.setGearInput({ keyway2: e.target.checked })}
                  />
                  Gear Keyway
                </label>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Side Visualizers & Bottom Results panels */}
        <main className="main-view">
          {/* Top visualizer panel */}
          <div className="visualization-workspace">
            {/* View Mode buttons */}
            <div className="visual-mode-toggle">
              <button
                className={`visual-mode-btn ${store.visualMode === '2d' ? 'active' : ''}`}
                onClick={() => store.setVisualMode('2d')}
              >
                2D Mesh
              </button>
              <button
                className={`visual-mode-btn ${store.visualMode === '3d' ? 'active' : ''}`}
                onClick={() => store.setVisualMode('3d')}
              >
                3D Preview
              </button>
            </div>

            {/* Animation control HUD overlay */}
            <div className="animation-overlay">
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px' }}
                onClick={() => store.setIsAnimating(!store.isAnimating)}
              >
                {store.isAnimating ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Speed:</span>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                className="speed-slider"
                value={store.animationSpeed}
                onChange={(e) => store.setAnimationSpeed(parseFloat(e.target.value))}
              />
            </div>

            {/* Progress loader HUD */}
            {cadProgress && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(5, 11, 20, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  zIndex: 20,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{cadProgress.stage}</div>
                <div style={{ width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${cadProgress.percent}%`, height: '100%', background: 'var(--accent-cyan)', transition: 'width 0.2s' }} />
                </div>
              </div>
            )}

            {/* Render 2D SVG vs 3D Fiber */}
            {store.visualMode === '2d' ? (
              <GearMesh2DView
                result={result}
                isAnimating={store.isAnimating}
                animationSpeed={store.animationSpeed}
              />
            ) : (
              <GearMesh3DView
                result={result}
                isAnimating={store.isAnimating}
                animationSpeed={store.animationSpeed}
              />
            )}
          </div>

          {/* Bottom Results Area */}
          <div className="bottom-results-panel">
            {/* Tabs */}
            <div className="tabs-navigation">
              {designMode === 'check' ? (
                <>
                  <button
                    className={`tab-btn ${store.activeTab === 'dimensions' ? 'active' : ''}`}
                    onClick={() => store.setActiveTab('dimensions')}
                  >
                    Geometry Specs
                  </button>
                  <button
                    className={`tab-btn ${store.activeTab === 'forces' ? 'active' : ''}`}
                    onClick={() => store.setActiveTab('forces')}
                  >
                    Mesh Forces
                  </button>
                  <button
                    className={`tab-btn ${store.activeTab === 'strength' ? 'active' : ''}`}
                    onClick={() => store.setActiveTab('strength')}
                  >
                    Bending Safety
                  </button>
                </>
              ) : (
                <button
                  className={`tab-btn ${store.activeTab === 'ratioSearch' ? 'active' : ''}`}
                  onClick={() => store.setActiveTab('ratioSearch')}
                >
                  Candidate Proposals
                </button>
              )}
              <button
                className={`tab-btn ${store.activeTab === 'validation' ? 'active' : ''}`}
                onClick={() => store.setActiveTab('validation')}
                style={{ position: 'relative' }}
              >
                Validation Issues
                {issues.length > 0 && (
                  <span
                    className={`badge ${numErrors > 0 ? 'badge-error' : 'badge-warning'}`}
                    style={{ marginLeft: '8px', padding: '1px 5px', fontSize: '9px' }}
                  >
                    {issues.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tabs Content */}
            <div className="results-content">
              {store.activeTab === 'dimensions' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Parameter Name</th>
                        <th>Symbol</th>
                        <th>Pinion (Gear 1)</th>
                        <th>Gear (Gear 2)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Pitch Diameter</td>
                        <td className="col-symbol">d</td>
                        <td>{geometry.pinion.d.toFixed(3)} mm</td>
                        <td>{geometry.gear.d.toFixed(3)} mm</td>
                      </tr>
                      <tr>
                        <td>Base Diameter</td>
                        <td className="col-symbol">db</td>
                        <td>{geometry.pinion.db.toFixed(3)} mm</td>
                        <td>{geometry.gear.db.toFixed(3)} mm</td>
                      </tr>
                      <tr>
                        <td>Outside Diameter</td>
                        <td className="col-symbol">da</td>
                        <td>{geometry.pinion.da.toFixed(3)} mm</td>
                        <td>{geometry.gear.da.toFixed(3)} mm</td>
                      </tr>
                      <tr>
                        <td>Root Diameter</td>
                        <td className="col-symbol">df</td>
                        <td>{geometry.pinion.df.toFixed(3)} mm</td>
                        <td>{geometry.gear.df.toFixed(3)} mm</td>
                      </tr>
                      <tr>
                        <td>Tooth Thickness at Pitch</td>
                        <td className="col-symbol">s</td>
                        <td>{geometry.pinion.s.toFixed(3)} mm</td>
                        <td>{geometry.gear.s.toFixed(3)} mm</td>
                      </tr>
                      <tr>
                        <td>Estimated Gear Mass</td>
                        <td className="col-symbol">mass</td>
                        <td>{geometry.pinion.mass.toFixed(2)} kg</td>
                        <td>{geometry.gear.mass.toFixed(2)} kg</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="grid-cards" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="card">
                      <div className="card-title">Operating Center Distance</div>
                      <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>
                        {geometry.aw.toFixed(3)} mm
                      </div>
                      <div className="card-subtext">Standard a = {geometry.a.toFixed(3)} mm</div>
                    </div>
                    <div className="card">
                      <div className="card-title">Contact Ratio</div>
                      <div className="card-value">
                        {geometry.contactRatio.toFixed(3)}{' '}
                        <span
                          className={`badge ${
                            geometry.contactRatio >= 1.4
                              ? 'badge-success'
                              : geometry.contactRatio >= 1.2
                              ? 'badge-warning'
                              : 'badge-error'
                          }`}
                          style={{ verticalAlign: 'middle', marginLeft: '8px' }}
                        >
                          {geometry.contactRatio >= 1.4 ? 'GOOD' : geometry.contactRatio >= 1.2 ? 'OK' : 'RISK'}
                        </span>
                      </div>
                      <div className="card-subtext">Transverse path of contact overlap</div>
                    </div>
                  </div>
                </div>
              )}

              {store.activeTab === 'forces' && (
                <div className="grid-cards">
                  <div className="card">
                    <div className="card-title">Tangential Force</div>
                    <div className="card-value" style={{ color: 'var(--accent-cyan)' }}>
                      {forces.Ft.toFixed(1)} N
                    </div>
                    <div className="card-subtext">Acts along the tangent line of contact</div>
                  </div>
                  <div className="card">
                    <div className="card-title">Radial Separation Force</div>
                    <div className="card-value" style={{ color: 'var(--accent-magenta)' }}>
                      {forces.Fr.toFixed(1)} N
                    </div>
                    <div className="card-subtext">Tends to push centers aw apart</div>
                  </div>
                  <div className="card">
                    <div className="card-title">Normal Mesh Force</div>
                    <div className="card-value">
                      {forces.Fn.toFixed(1)} N
                    </div>
                    <div className="card-subtext">Total load force along path of action</div>
                  </div>
                  <div className="card">
                    <div className="card-title">Pitch Line Velocity</div>
                    <div className="card-value">
                      {forces.v.toFixed(2)} m/s
                    </div>
                    <div className="card-subtext">Linear speed at operating pitch circle</div>
                  </div>
                </div>
              )}

              {store.activeTab === 'strength' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="grid-cards">
                    <div className="card">
                      <div className="card-title">Pinion Bending Stress</div>
                      <div className="card-value" style={{ color: strength.pinionSafetyFactor < 1.0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                        {strength.pinionBendingStress.toFixed(1)} MPa
                      </div>
                      <div className="card-subtext">Allowable limit: {materialInput.allowableBending1} MPa</div>
                    </div>
                    <div className="card">
                      <div className="card-title">Pinion Safety Factor</div>
                      <div className="card-value">
                        {strength.pinionSafetyFactor > 99 ? 'No Load' : strength.pinionSafetyFactor.toFixed(2)}{' '}
                        {strength.pinionSafetyFactor > 99 ? null : (
                          <span className={`badge ${strength.pinionSafetyFactor >= 1.5 ? 'badge-success' : strength.pinionSafetyFactor >= 1.0 ? 'badge-warning' : 'badge-error'}`} style={{ marginLeft: 8 }}>
                            {strength.pinionSafetyFactor >= 1.5 ? 'SAFE' : strength.pinionSafetyFactor >= 1.0 ? 'MINIMAL' : 'DANGER'}
                          </span>
                        )}
                      </div>
                      <div className="card-subtext">Bending stress safety factor (Lewis check)</div>
                    </div>
                    <div className="card">
                      <div className="card-title">Gear Bending Stress</div>
                      <div className="card-value" style={{ color: strength.gearSafetyFactor < 1.0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                        {strength.gearBendingStress.toFixed(1)} MPa
                      </div>
                      <div className="card-subtext">Allowable limit: {materialInput.allowableBending2} MPa</div>
                    </div>
                    <div className="card">
                      <div className="card-title">Gear Safety Factor</div>
                      <div className="card-value">
                        {strength.gearSafetyFactor > 99 ? 'No Load' : strength.gearSafetyFactor.toFixed(2)}{' '}
                        {strength.gearSafetyFactor > 99 ? null : (
                          <span className={`badge ${strength.gearSafetyFactor >= 1.5 ? 'badge-success' : strength.gearSafetyFactor >= 1.0 ? 'badge-warning' : 'badge-error'}`} style={{ marginLeft: 8 }}>
                            {strength.gearSafetyFactor >= 1.5 ? 'SAFE' : strength.gearSafetyFactor >= 1.0 ? 'MINIMAL' : 'DANGER'}
                          </span>
                        )}
                      </div>
                      <div className="card-subtext">Bending stress safety factor (Lewis check)</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '4px' }}>
                    Note: Bending strength calculation is based on a simplified Lewis method with profile shift thickness correction. Final mechanical design loads must be certified using standard ISO 6336 or AGMA procedures.
                  </div>
                </div>
              )}

              {store.activeTab === 'ratioSearch' && (
                <div style={{ height: '100%', overflowY: 'auto' }}>
                  <div className="search-controls-grid">
                    <div className="form-group">
                      <label className="form-label">Target Ratio</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={store.searchOptions.ratioTarget}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1.0;
                          store.setSearchOptions({ ratioTarget: val });
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Center Distance Target</label>
                      <input
                        type="number"
                        className="form-input"
                        value={store.searchOptions.centerDistanceTarget || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || undefined;
                          store.setSearchOptions({ centerDistanceTarget: val });
                        }}
                        placeholder="Auto"
                      />
                    </div>
                    <button className="btn btn-primary" style={{ alignSelf: 'end' }} onClick={store.runRatioSearch}>
                      <Search size={14} /> Propose Sets
                    </button>
                  </div>

                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Pinion (z1)</th>
                        <th>Gear (z2)</th>
                        <th>Module (m)</th>
                        <th>Ratio</th>
                        <th>Ratio Error</th>
                        <th>Center Dist.</th>
                        <th>Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.searchResults.map((cand) => (
                        <tr key={cand.rank}>
                          <td>#{cand.rank}</td>
                          <td>{cand.z1}</td>
                          <td>{cand.z2}</td>
                          <td>{cand.module} mm</td>
                          <td>{cand.ratio.toFixed(3)}</td>
                          <td>{cand.ratioError.toFixed(2)}%</td>
                          <td>{cand.centerDistance.toFixed(2)} mm</td>
                          <td>
                            <span className="badge badge-success">{cand.score}/100</span>
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => store.applyCandidate(cand)}>
                              Apply
                            </button>
                          </td>
                        </tr>
                      ))}
                      {store.searchResults.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No proposals run. Adjust target criteria and click "Propose Sets".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {store.activeTab === 'validation' && (
                <div className="issues-list">
                  {issues.map((issue) => (
                    <div key={issue.id} className={`issue-item ${issue.severity}`}>
                      <div style={{ color: issue.severity === 'error' ? 'var(--accent-rose)' : issue.severity === 'warning' ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>
                        {issue.severity === 'error' ? <AlertCircle size={20} /> : <AlertTriangle size={20} />}
                      </div>
                      <div className="issue-content">
                        <div className="issue-title">{issue.title}</div>
                        <div className="issue-desc">{issue.message}</div>
                        {issue.suggestedFix && <div className="issue-fix">Recommendation: {issue.suggestedFix}</div>}
                      </div>
                    </div>
                  ))}
                  {issues.length === 0 && (
                    <div className="issue-item success" style={{ background: 'rgba(16,185,129,0.05)', borderLeftColor: 'var(--accent-emerald)' }}>
                      <div style={{ color: 'var(--accent-emerald)' }}>
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="issue-content">
                        <div className="issue-title" style={{ color: 'var(--accent-emerald)' }}>All Checks Passed</div>
                        <div className="issue-desc">The current gear pair setup satisfies basic geometric, contact ratio, and safety limits.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
