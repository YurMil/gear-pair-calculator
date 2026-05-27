import React, { useRef, useEffect, useState, useMemo } from 'react';
import { generateGearProfile, Point2D } from '../domain/involute';
import type { CalculationResult } from '../domain/types';

interface GearMesh2DViewProps {
  result: CalculationResult;
  isAnimating: boolean;
  animationSpeed: number;
}

const FLANK_POINTS = 24;
const ROOT_POINTS = 8;

// Convert Point2D array to SVG path data string (closed)
function getPathData(points: Point2D[]): string {
  if (points.length === 0) return '';
  return 'M ' + points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' L ') + ' Z';
}

export function GearMesh2DView({ result, isAnimating, animationSpeed }: GearMesh2DViewProps) {
  const { geometry, gearInput } = result;
  const { pinion, gear, aw, ratio } = geometry;

  const svgRef = useRef<SVGSVGElement>(null);
  const pinionRef = useRef<SVGGElement>(null);
  const gearRef = useRef<SVGGElement>(null);

  // Transform state for pan/zoom (applied to inner <g>)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const dragOriginRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Reference circle toggles
  const [showPitchCircles, setShowPitchCircles] = useState(true);
  const [showBaseCircles, setShowBaseCircles] = useState(false);
  const [showOutsideCircles, setShowOutsideCircles] = useState(false);
  const [showRootCircles, setShowRootCircles] = useState(false);
  const [showLineOfAction, setShowLineOfAction] = useState(true);

  // Profiles: pure derived state — useMemo, not useState+useEffect.
  const pinionPoints = useMemo(
    () =>
      generateGearProfile(
        pinion.z,
        pinion.m,
        gearInput.pressureAngle,
        gearInput.x1,
        gearInput.addendumCoeff,
        gearInput.dedendumCoeff,
        geometry.deltaY,
        FLANK_POINTS,
        ROOT_POINTS
      ),
    [
      pinion.z,
      pinion.m,
      gearInput.pressureAngle,
      gearInput.x1,
      gearInput.addendumCoeff,
      gearInput.dedendumCoeff,
      geometry.deltaY,
    ]
  );

  const gearPoints = useMemo(
    () =>
      generateGearProfile(
        gear.z,
        gear.m,
        gearInput.pressureAngle,
        gearInput.x2,
        gearInput.addendumCoeff,
        gearInput.dedendumCoeff,
        geometry.deltaY,
        FLANK_POINTS,
        ROOT_POINTS
      ),
    [
      gear.z,
      gear.m,
      gearInput.pressureAngle,
      gearInput.x2,
      gearInput.addendumCoeff,
      gearInput.dedendumCoeff,
      geometry.deltaY,
    ]
  );

  const pinionPath = useMemo(() => getPathData(pinionPoints), [pinionPoints]);
  const gearPath = useMemo(() => getPathData(gearPoints), [gearPoints]);

  // Auto-fit viewBox to the assembly bounds with margin.
  const viewBox = useMemo(() => {
    const xMin = -pinion.da / 2;
    const xMax = aw + gear.da / 2;
    const yExt = Math.max(pinion.da, gear.da) / 2;
    const span = xMax - xMin;
    const margin = Math.max(5, span * 0.08);
    const w = span + 2 * margin;
    const h = 2 * yExt + 2 * margin;
    return `${xMin - margin} ${-yExt - margin} ${w} ${h}`;
  }, [pinion.da, gear.da, aw]);

  // Active line-of-action segment (between intersections with outside circles).
  // This is the portion where the teeth actually engage — a useful overlay for collision inspection.
  const actionLine = useMemo(() => {
    const alpha = (gearInput.pressureAngle * Math.PI) / 180;
    const rb1 = pinion.db / 2;
    const rb2 = gear.db / 2;
    const ra1 = pinion.da / 2;
    const ra2 = gear.da / 2;

    // Full tangent line: from (rb1*sin a, rb1*cos a) to (aw - rb2*sin a, -rb2*cos a).
    const Tx1 = rb1 * Math.sin(alpha);
    const Ty1 = rb1 * Math.cos(alpha);
    const Tx2 = aw - rb2 * Math.sin(alpha);
    const Ty2 = -rb2 * Math.cos(alpha);

    // Active arc bounds: where the line intersects the addendum circles.
    // Param: point on line of action parameterized along the tangent.
    // For pinion: intersection at radius ra1 from origin.
    // For gear: intersection at radius ra2 from (aw, 0).
    const lenAB = Math.hypot(Tx2 - Tx1, Ty2 - Ty1);
    let activeStart = { x: Tx1, y: Ty1 };
    let activeEnd = { x: Tx2, y: Ty2 };
    const term1 = ra1 * ra1 - rb1 * rb1;
    const term2 = ra2 * ra2 - rb2 * rb2;
    if (term1 > 0 && term2 > 0 && lenAB > 0) {
      const d1 = Math.sqrt(term1); // distance from base-tangent point along line for pinion outside
      const d2 = Math.sqrt(term2);
      const ux = (Tx2 - Tx1) / lenAB;
      const uy = (Ty2 - Ty1) / lenAB;
      // active start: from pinion side, distance d1 along the line toward the gear
      activeStart = { x: Tx1 + ux * d1, y: Ty1 + uy * d1 };
      // active end: from gear side, distance d2 backward
      activeEnd = { x: Tx2 - ux * d2, y: Ty2 - uy * d2 };
    }

    return { Tx1, Ty1, Tx2, Ty2, activeStart, activeEnd };
  }, [pinion.db, pinion.da, gear.db, gear.da, aw, gearInput.pressureAngle]);

  // Animation loop. Note: rAF always runs, but DOM is only updated when angle changes.
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();
    let localPinionAngle = 0;

    // Half-pitch offset so a pinion tooth lines up with a gear gap.
    const gearBaseAngle = gear.z % 2 === 0 ? Math.PI + Math.PI / gear.z : Math.PI;
    const gearBaseAngleDeg = (gearBaseAngle * 180) / Math.PI;

    // Initialize gear angle so the engaged frame is correct even when paused.
    if (gearRef.current) {
      gearRef.current.setAttribute('transform', `translate(${aw}, 0) rotate(${gearBaseAngleDeg})`);
    }

    const animate = (time: number) => {
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;

      if (isAnimating) {
        const baseSpeedDegPerSec = 180;
        localPinionAngle += baseSpeedDegPerSec * deltaSec * animationSpeed;
        localPinionAngle %= 360;

        if (pinionRef.current) {
          pinionRef.current.setAttribute('transform', `rotate(${localPinionAngle})`);
        }
        if (gearRef.current) {
          const gearAngleDeg = gearBaseAngleDeg - localPinionAngle / ratio;
          gearRef.current.setAttribute('transform', `translate(${aw}, 0) rotate(${gearAngleDeg})`);
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isAnimating, animationSpeed, ratio, aw, gear.z]);

  // --- Pan / Zoom ----------------------------------------------------------

  // Convert client coords to SVG user-space coords (the viewBox space).
  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const sp = pt.matrixTransform(inv);
    return { x: sp.x, y: sp.y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const sp = clientToSvg(e.clientX, e.clientY);
    dragOriginRef.current = { x: sp.x, y: sp.y, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const sp = clientToSvg(e.clientX, e.clientY);
    setPan({
      x: dragOriginRef.current.panX + (sp.x - dragOriginRef.current.x),
      y: dragOriginRef.current.panY + (sp.y - dragOriginRef.current.y),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const sp = clientToSvg(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.2, Math.min(zoom * factor, 50));
    if (newZoom === zoom) return;

    // Keep the world point under the cursor stationary.
    // Inner <g> transform: screen_sp = world * zoom + pan
    // → world = (sp - pan) / zoom; newPan = sp - world * newZoom
    const worldX = (sp.x - pan.x) / zoom;
    const worldY = (sp.y - pan.y) / zoom;
    setPan({
      x: sp.x - worldX * newZoom,
      y: sp.y - worldY * newZoom,
    });
    setZoom(newZoom);
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  };

  // --- Render --------------------------------------------------------------

  // Grid step adapts to assembly size so the background never overwhelms the drawing.
  const gridStep = useMemo(() => {
    const span = pinion.da / 2 + gear.da / 2 + aw;
    if (span < 30) return 2;
    if (span < 100) return 5;
    if (span < 300) return 10;
    return 20;
  }, [pinion.da, gear.da, aw]);

  return (
    <div className="viewer-container">
      <div className="viewer-toolbar">
        <span className="viewer-title">2D Engaged Mesh</span>
        <div className="toolbar-controls">
          <label className="checkbox-label">
            <input type="checkbox" checked={showPitchCircles} onChange={(e) => setShowPitchCircles(e.target.checked)} />
            Pitch
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={showBaseCircles} onChange={(e) => setShowBaseCircles(e.target.checked)} />
            Base
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={showOutsideCircles} onChange={(e) => setShowOutsideCircles(e.target.checked)} />
            Outside
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={showRootCircles} onChange={(e) => setShowRootCircles(e.target.checked)} />
            Root
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={showLineOfAction} onChange={(e) => setShowLineOfAction(e.target.checked)} />
            Action Line
          </label>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {(zoom * 100).toFixed(0)}%
          </span>
          <button className="btn btn-secondary btn-sm" onClick={resetView}>Reset View</button>
        </div>
      </div>

      <div
        className="svg-wrapper"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'hidden', display: 'block' }}
        >
          <defs>
            <pattern id="grid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
              <path
                d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Grid background — sized large enough to fill at extreme pans */}
            <rect
              x={-10000}
              y={-10000}
              width={20000}
              height={20000}
              fill="url(#grid)"
              pointerEvents="none"
            />

            {/* Centerline */}
            <line
              x1={-pinion.da}
              y1={0}
              x2={aw + gear.da}
              y2={0}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeDasharray="6,4"
              vectorEffect="non-scaling-stroke"
            />

            {/* Pinion center mark */}
            <g stroke="rgba(255,255,255,0.4)" strokeWidth="1" vectorEffect="non-scaling-stroke">
              <line x1={-pinion.da * 0.04} y1={0} x2={pinion.da * 0.04} y2={0} />
              <line x1={0} y1={-pinion.da * 0.04} x2={0} y2={pinion.da * 0.04} />
            </g>

            {/* Gear center mark */}
            <g
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              transform={`translate(${aw}, 0)`}
            >
              <line x1={-gear.da * 0.04} y1={0} x2={gear.da * 0.04} y2={0} />
              <line x1={0} y1={-gear.da * 0.04} x2={0} y2={gear.da * 0.04} />
            </g>

            {/* Reference circles */}
            {showPitchCircles && (
              <>
                <circle cx={0} cy={0} r={pinion.d / 2} fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="4,3" vectorEffect="non-scaling-stroke" />
                <circle cx={aw} cy={0} r={gear.d / 2} fill="none" stroke="#e879f9" strokeWidth="1" strokeDasharray="4,3" vectorEffect="non-scaling-stroke" />
                {/* Operating pitch circles (computed from aw) */}
                <circle cx={0} cy={0} r={(aw * pinion.z) / (pinion.z + gear.z)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                <circle cx={aw} cy={0} r={(aw * gear.z) / (pinion.z + gear.z)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              </>
            )}

            {showBaseCircles && (
              <>
                <circle cx={0} cy={0} r={pinion.db / 2} fill="none" stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="2,4" vectorEffect="non-scaling-stroke" />
                <circle cx={aw} cy={0} r={gear.db / 2} fill="none" stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="2,4" vectorEffect="non-scaling-stroke" />
              </>
            )}

            {showOutsideCircles && (
              <>
                <circle cx={0} cy={0} r={pinion.da / 2} fill="none" stroke="#a855f7" strokeWidth="0.8" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
                <circle cx={aw} cy={0} r={gear.da / 2} fill="none" stroke="#a855f7" strokeWidth="0.8" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
              </>
            )}

            {showRootCircles && (
              <>
                <circle cx={0} cy={0} r={pinion.df / 2} fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="1,3" vectorEffect="non-scaling-stroke" />
                <circle cx={aw} cy={0} r={gear.df / 2} fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="1,3" vectorEffect="non-scaling-stroke" />
              </>
            )}

            {/* Line of action — full tangent (dim) + active engaged segment (bright) */}
            {showLineOfAction && (
              <>
                <line
                  x1={actionLine.Tx1}
                  y1={actionLine.Ty1}
                  x2={actionLine.Tx2}
                  y2={actionLine.Ty2}
                  stroke="rgba(251,191,36,0.35)"
                  strokeWidth="0.8"
                  strokeDasharray="3,3"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={actionLine.activeStart.x}
                  y1={actionLine.activeStart.y}
                  x2={actionLine.activeEnd.x}
                  y2={actionLine.activeEnd.y}
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={actionLine.activeStart.x} cy={actionLine.activeStart.y} r={1.5} fill="#fbbf24" vectorEffect="non-scaling-stroke" />
                <circle cx={actionLine.activeEnd.x} cy={actionLine.activeEnd.y} r={1.5} fill="#fbbf24" vectorEffect="non-scaling-stroke" />
              </>
            )}

            {/* Pinion (rotated by animation) */}
            <g ref={pinionRef}>
              <path
                d={pinionPath}
                fill="rgba(34, 211, 238, 0.12)"
                stroke="#22d3ee"
                strokeWidth="1.25"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {gearInput.bore1 > 0 && (
                <circle cx={0} cy={0} r={gearInput.bore1 / 2} fill="#0b0c10" stroke="#22d3ee" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
            </g>

            {/* Gear (translated + rotated by animation) */}
            <g ref={gearRef}>
              <path
                d={gearPath}
                fill="rgba(232, 121, 249, 0.12)"
                stroke="#e879f9"
                strokeWidth="1.25"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {gearInput.bore2 > 0 && (
                <circle cx={0} cy={0} r={gearInput.bore2 / 2} fill="#0b0c10" stroke="#e879f9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
