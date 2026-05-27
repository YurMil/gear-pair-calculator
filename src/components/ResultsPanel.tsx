import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { useGearStore } from '../state/gearStore';
import type { CalculationResult } from '../domain/types';

interface ResultsPanelProps {
  result: CalculationResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const designMode = useGearStore((s) => s.designMode);
  const activeTab = useGearStore((s) => s.activeTab);
  const setActiveTab = useGearStore((s) => s.setActiveTab);

  const { issues } = result;
  const numErrors = issues.filter((i) => i.severity === 'error').length;

  return (
    <div className="bottom-results-panel">
      <div className="tabs-navigation">
        {designMode === 'check' ? (
          <>
            <TabButton id="dimensions" active={activeTab === 'dimensions'} onClick={() => setActiveTab('dimensions')}>
              Geometry Specs
            </TabButton>
            <TabButton id="forces" active={activeTab === 'forces'} onClick={() => setActiveTab('forces')}>
              Mesh Forces
            </TabButton>
            <TabButton id="strength" active={activeTab === 'strength'} onClick={() => setActiveTab('strength')}>
              Bending Safety
            </TabButton>
          </>
        ) : (
          <TabButton id="ratioSearch" active={activeTab === 'ratioSearch'} onClick={() => setActiveTab('ratioSearch')}>
            Candidate Proposals
          </TabButton>
        )}
        <button
          className={`tab-btn ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
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

      <div className="results-content">
        {activeTab === 'dimensions' && <DimensionsTab result={result} />}
        {activeTab === 'forces' && <ForcesTab result={result} />}
        {activeTab === 'strength' && <StrengthTab result={result} />}
        {activeTab === 'ratioSearch' && <RatioSearchTab />}
        {activeTab === 'validation' && <ValidationTab result={result} />}
      </div>
    </div>
  );
}

function TabButton({
  id,
  active,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

// --- Dimensions tab --------------------------------------------------------

function DimensionsTab({ result }: { result: CalculationResult }) {
  const { geometry } = result;
  return (
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
          <GeomRow name="Pitch Diameter" symbol="d" p={geometry.pinion.d} g={geometry.gear.d} unit="mm" />
          <GeomRow name="Base Diameter" symbol="db" p={geometry.pinion.db} g={geometry.gear.db} unit="mm" />
          <GeomRow name="Outside Diameter" symbol="da" p={geometry.pinion.da} g={geometry.gear.da} unit="mm" />
          <GeomRow name="Root Diameter" symbol="df" p={geometry.pinion.df} g={geometry.gear.df} unit="mm" />
          <GeomRow name="Tooth Thickness at Pitch" symbol="s" p={geometry.pinion.s} g={geometry.gear.s} unit="mm" />
          <GeomRow name="Estimated Gear Mass" symbol="mass" p={geometry.pinion.mass} g={geometry.gear.mass} unit="kg" digits={2} />
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
  );
}

function GeomRow({
  name,
  symbol,
  p,
  g,
  unit,
  digits = 3,
}: {
  name: string;
  symbol: string;
  p: number;
  g: number;
  unit: string;
  digits?: number;
}) {
  return (
    <tr>
      <td>{name}</td>
      <td className="col-symbol">{symbol}</td>
      <td>
        {p.toFixed(digits)} {unit}
      </td>
      <td>
        {g.toFixed(digits)} {unit}
      </td>
    </tr>
  );
}

// --- Forces tab ------------------------------------------------------------

function ForcesTab({ result }: { result: CalculationResult }) {
  const { forces } = result;
  return (
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
        <div className="card-value">{forces.Fn.toFixed(1)} N</div>
        <div className="card-subtext">Total load force along path of action</div>
      </div>
      <div className="card">
        <div className="card-title">Pitch Line Velocity</div>
        <div className="card-value">{forces.v.toFixed(2)} m/s</div>
        <div className="card-subtext">Linear speed at operating pitch circle</div>
      </div>
    </div>
  );
}

// --- Strength tab ----------------------------------------------------------

function StrengthTab({ result }: { result: CalculationResult }) {
  const { strength, materialInput } = result;

  const safetyBadge = (sf: number) =>
    sf >= 1.5 ? 'SAFE' : sf >= 1.0 ? 'MINIMAL' : 'DANGER';
  const safetyBadgeClass = (sf: number) =>
    sf >= 1.5 ? 'badge-success' : sf >= 1.0 ? 'badge-warning' : 'badge-error';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="grid-cards">
        <div className="card">
          <div className="card-title">Pinion Bending Stress</div>
          <div
            className="card-value"
            style={{
              color: strength.pinionSafetyFactor < 1.0 ? 'var(--accent-rose)' : 'var(--text-primary)',
            }}
          >
            {strength.pinionBendingStress.toFixed(1)} MPa
          </div>
          <div className="card-subtext">Allowable limit: {materialInput.allowableBending1} MPa</div>
        </div>
        <div className="card">
          <div className="card-title">Pinion Safety Factor</div>
          <div className="card-value">
            {strength.pinionSafetyFactor > 99 ? 'No Load' : strength.pinionSafetyFactor.toFixed(2)}{' '}
            {strength.pinionSafetyFactor > 99 ? null : (
              <span
                className={`badge ${safetyBadgeClass(strength.pinionSafetyFactor)}`}
                style={{ marginLeft: 8 }}
              >
                {safetyBadge(strength.pinionSafetyFactor)}
              </span>
            )}
          </div>
          <div className="card-subtext">Bending stress safety factor (Lewis check)</div>
        </div>
        <div className="card">
          <div className="card-title">Gear Bending Stress</div>
          <div
            className="card-value"
            style={{
              color: strength.gearSafetyFactor < 1.0 ? 'var(--accent-rose)' : 'var(--text-primary)',
            }}
          >
            {strength.gearBendingStress.toFixed(1)} MPa
          </div>
          <div className="card-subtext">Allowable limit: {materialInput.allowableBending2} MPa</div>
        </div>
        <div className="card">
          <div className="card-title">Gear Safety Factor</div>
          <div className="card-value">
            {strength.gearSafetyFactor > 99 ? 'No Load' : strength.gearSafetyFactor.toFixed(2)}{' '}
            {strength.gearSafetyFactor > 99 ? null : (
              <span
                className={`badge ${safetyBadgeClass(strength.gearSafetyFactor)}`}
                style={{ marginLeft: 8 }}
              >
                {safetyBadge(strength.gearSafetyFactor)}
              </span>
            )}
          </div>
          <div className="card-subtext">Bending stress safety factor (Lewis check)</div>
        </div>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.02)',
          padding: '8px 12px',
          borderRadius: '4px',
        }}
      >
        Note: Bending strength calculation is based on a simplified Lewis method with profile shift thickness
        correction. Final mechanical design loads must be certified using standard ISO 6336 or AGMA procedures.
      </div>
    </div>
  );
}

// --- Ratio search tab ------------------------------------------------------

function RatioSearchTab() {
  const searchOptions = useGearStore((s) => s.searchOptions);
  const setSearchOptions = useGearStore((s) => s.setSearchOptions);
  const searchResults = useGearStore((s) => s.searchResults);
  const runRatioSearch = useGearStore((s) => s.runRatioSearch);
  const applyCandidate = useGearStore((s) => s.applyCandidate);

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div className="search-controls-grid">
        <div className="form-group">
          <label className="form-label">Target Ratio</label>
          <input
            type="number"
            step="0.01"
            className="form-input"
            value={searchOptions.ratioTarget}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 1.0;
              setSearchOptions({ ratioTarget: val });
            }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Center Distance Target</label>
          <input
            type="number"
            className="form-input"
            value={searchOptions.centerDistanceTarget || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || undefined;
              setSearchOptions({ centerDistanceTarget: val });
            }}
            placeholder="Auto"
          />
        </div>
        <button className="btn btn-primary" style={{ alignSelf: 'end' }} onClick={runRatioSearch}>
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
          {searchResults.map((cand) => (
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
                <button className="btn btn-secondary btn-sm" onClick={() => applyCandidate(cand)}>
                  Apply
                </button>
              </td>
            </tr>
          ))}
          {searchResults.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                No proposals run. Adjust target criteria and click "Propose Sets".
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Validation tab --------------------------------------------------------

function ValidationTab({ result }: { result: CalculationResult }) {
  const { issues } = result;
  return (
    <div className="issues-list">
      {issues.map((issue) => (
        <div key={issue.id} className={`issue-item ${issue.severity}`}>
          <div
            style={{
              color:
                issue.severity === 'error'
                  ? 'var(--accent-rose)'
                  : issue.severity === 'warning'
                  ? 'var(--accent-amber)'
                  : 'var(--accent-cyan)',
            }}
          >
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
        <div
          className="issue-item success"
          style={{ background: 'rgba(16,185,129,0.05)', borderLeftColor: 'var(--accent-emerald)' }}
        >
          <div style={{ color: 'var(--accent-emerald)' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="issue-content">
            <div className="issue-title" style={{ color: 'var(--accent-emerald)' }}>
              All Checks Passed
            </div>
            <div className="issue-desc">
              The current gear pair setup satisfies basic geometric, contact ratio, and safety limits.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
