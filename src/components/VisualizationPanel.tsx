import React from 'react';
import { Play, Pause } from 'lucide-react';
import { useGearStore } from '../state/gearStore';
import { GearMesh2DView } from './GearMesh2DView';
import { GearMesh3DView } from './GearMesh3DView';
import type { CalculationResult } from '../domain/types';

interface VisualizationPanelProps {
  result: CalculationResult;
  cadProgress: { stage: string; percent: number } | null;
}

export function VisualizationPanel({ result, cadProgress }: VisualizationPanelProps) {
  const visualMode = useGearStore((s) => s.visualMode);
  const setVisualMode = useGearStore((s) => s.setVisualMode);
  const isAnimating = useGearStore((s) => s.isAnimating);
  const setIsAnimating = useGearStore((s) => s.setIsAnimating);
  const animationSpeed = useGearStore((s) => s.animationSpeed);
  const setAnimationSpeed = useGearStore((s) => s.setAnimationSpeed);

  return (
    <div className="visualization-workspace">
      {/* View mode toggle */}
      <div className="visual-mode-toggle">
        <button
          className={`visual-mode-btn ${visualMode === '2d' ? 'active' : ''}`}
          onClick={() => setVisualMode('2d')}
        >
          2D Mesh
        </button>
        <button
          className={`visual-mode-btn ${visualMode === '3d' ? 'active' : ''}`}
          onClick={() => setVisualMode('3d')}
        >
          3D Preview
        </button>
      </div>

      {/* Animation HUD */}
      <div className="animation-overlay">
        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px' }}
          onClick={() => setIsAnimating(!isAnimating)}
        >
          {isAnimating ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Speed:</span>
        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.1"
          className="speed-slider"
          value={animationSpeed}
          onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
        />
      </div>

      {/* CAD progress overlay */}
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
          <div
            style={{
              width: '200px',
              height: '4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${cadProgress.percent}%`,
                height: '100%',
                background: 'var(--accent-cyan)',
                transition: 'width 0.2s',
              }}
            />
          </div>
        </div>
      )}

      {visualMode === '2d' ? (
        <GearMesh2DView result={result} isAnimating={isAnimating} animationSpeed={animationSpeed} />
      ) : (
        <GearMesh3DView result={result} isAnimating={isAnimating} animationSpeed={animationSpeed} />
      )}
    </div>
  );
}
