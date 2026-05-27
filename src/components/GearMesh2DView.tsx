import React, { useRef, useEffect, useState } from 'react';
import { generateGearProfile, Point2D } from '../domain/involute';
import type { CalculationResult } from '../domain/types';

interface GearMesh2DViewProps {
  result: CalculationResult;
  isAnimating: boolean;
  animationSpeed: number;
}

export function GearMesh2DView({ result, isAnimating, animationSpeed }: GearMesh2DViewProps) {
  const { geometry, gearInput, loadInput } = result;
  const { pinion, gear, aw, ratio } = geometry;

  const pinionRef = useRef<SVGGElement>(null);
  const gearRef = useRef<SVGGElement>(null);
  
  // Transform state for pan/zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // View parameters
  const [showPitchCircles, setShowPitchCircles] = useState(true);
  const [showBaseCircles, setShowBaseCircles] = useState(false);
  const [showOutsideCircles, setShowOutsideCircles] = useState(false);
  const [showRootCircles, setShowRootCircles] = useState(false);
  const [showLineOfAction, setShowLineOfAction] = useState(true);

  // Generate 2D tooth profiles
  const [pinionPoints, setPinionPoints] = useState<Point2D[]>([]);
  const [gearPoints, setGearPoints] = useState<Point2D[]>([]);

  useEffect(() => {
    // Generate points with a reasonable resolution
    const pPts = generateGearProfile(
      pinion.z,
      pinion.m,
      gearInput.pressureAngle,
      gearInput.x1,
      gearInput.addendumCoeff,
      gearInput.dedendumCoeff,
      geometry.deltaY,
      12, // flank resolution
      4   // root resolution
    );
    const gPts = generateGearProfile(
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
    setPinionPoints(pPts);
    setGearPoints(gPts);
  }, [pinion.z, pinion.m, gear.z, gear.m, gearInput.x1, gearInput.x2, gearInput.pressureAngle, geometry.deltaY]);

  // Animation loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();
    let localPinionAngle = 0;

    const gearBaseAngle = gear.z % 2 === 0 ? Math.PI + Math.PI / gear.z : Math.PI;

    const animate = (time: number) => {
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;

      if (isAnimating) {
        // Use a fixed base speed for preview so it doesn't spin wildly based on actual physical RPM
        const baseSpeedDegPerSec = 180; // Half a rotation per second
        localPinionAngle += baseSpeedDegPerSec * deltaSec * animationSpeed;
        localPinionAngle %= 360;
      }

      // Update DOM nodes directly to bypass React re-renders for smooth 60fps
      if (pinionRef.current) {
        pinionRef.current.setAttribute('transform', `rotate(${localPinionAngle})`);
      }
      
      if (gearRef.current) {
        const pinionAngleRad = (localPinionAngle * Math.PI) / 180;
        const gearAngleRad = gearBaseAngle - pinionAngleRad / ratio;
        const gearAngleDeg = (gearAngleRad * 180) / Math.PI;
        gearRef.current.setAttribute('transform', `translate(${aw}, 0) rotate(${gearAngleDeg})`);
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isAnimating, animationSpeed, loadInput.speed1, ratio, aw, gear.z]);

  // Convert Point2D array to SVG path data string
  const getPathData = (points: Point2D[]) => {
    if (points.length === 0) return '';
    return 'M ' + points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' L ') + ' Z';
  };

  // Pan and zoom event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z * zoomFactor, 10));
    } else {
      setZoom((z) => Math.max(z / zoomFactor, 0.2));
    }
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  };

  // Center line of action calculations
  const pressureAngleRad = (gearInput.pressureAngle * Math.PI) / 180;
  // Start and end of line of action tangent to base circles
  const rb1 = pinion.db / 2;
  const rb2 = gear.db / 2;
  const lineOfActionX1 = rb1 * Math.sin(pressureAngleRad);
  const lineOfActionY1 = rb1 * Math.cos(pressureAngleRad);
  const lineOfActionX2 = aw - rb2 * Math.sin(pressureAngleRad);
  const lineOfActionY2 = -rb2 * Math.cos(pressureAngleRad);

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
          width="100%"
          height="100%"
          viewBox="-120 -100 350 200"
          style={{ overflow: 'hidden' }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Grid background */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="-500" y="-500" width="1000" height="1000" fill="url(#grid)" pointerEvents="none" />

            {/* X-axis line of centers */}
            <line x1="-50" y1="0" x2={aw + 50} y2="0" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="5,5" />
            
            {/* Pinion Center Mark */}
            <line x1="-5" y1="0" x2="5" y2="0" stroke="rgba(255,255,255,0.3)" strokeWidth="0.75" />
            <line x1="0" y1="-5" x2="0" y2="5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.75" />

            {/* Gear Center Mark */}
            <line x1={aw - 5} y1="0" x2={aw + 5} y2="0" stroke="rgba(255,255,255,0.3)" strokeWidth="0.75" />
            <line x1={aw} y1="-5" x2={aw} y2="5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.75" />

            {/* Reference Circles (Static) */}
            {showPitchCircles && (
              <>
                {/* Pinion pitch diameter circle */}
                <circle cx="0" cy="0" r={pinion.d / 2} fill="none" stroke="#22d3ee" strokeWidth="0.75" strokeDasharray="3,3" />
                {/* Gear pitch diameter circle */}
                <circle cx={aw} cy="0" r={gear.d / 2} fill="none" stroke="#e879f9" strokeWidth="0.75" strokeDasharray="3,3" />
                {/* Operating pitch circles */}
                <circle cx="0" cy="0" r={(2 * aw * pinion.z) / (pinion.z + gear.z) / 2} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                <circle cx={aw} cy="0" r={(2 * aw * gear.z) / (pinion.z + gear.z) / 2} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              </>
            )}

            {showBaseCircles && (
              <>
                <circle cx="0" cy="0" r={pinion.db / 2} fill="none" stroke="#f43f5e" strokeWidth="0.5" strokeDasharray="2,4" />
                <circle cx={aw} cy="0" r={gear.db / 2} fill="none" stroke="#f43f5e" strokeWidth="0.5" strokeDasharray="2,4" />
              </>
            )}

            {showOutsideCircles && (
              <>
                <circle cx="0" cy="0" r={pinion.da / 2} fill="none" stroke="#a855f7" strokeWidth="0.5" strokeDasharray="2,2" />
                <circle cx={aw} cy="0" r={gear.da / 2} fill="none" stroke="#a855f7" strokeWidth="0.5" strokeDasharray="2,2" />
              </>
            )}

            {showRootCircles && (
              <>
                <circle cx="0" cy="0" r={pinion.df / 2} fill="none" stroke="#10b981" strokeWidth="0.5" strokeDasharray="1,3" />
                <circle cx={aw} cy="0" r={gear.df / 2} fill="none" stroke="#10b981" strokeWidth="0.5" strokeDasharray="1,3" />
              </>
            )}

            {/* Line of action tangent to base circles */}
            {showLineOfAction && (
              <>
                <line x1={lineOfActionX1} y1={lineOfActionY1} x2={lineOfActionX2} y2={lineOfActionY2} stroke="#fbbf24" strokeWidth="0.75" strokeDasharray="4,2" />
                <circle cx={lineOfActionX1} cy={lineOfActionY1} r="1.5" fill="#fbbf24" />
                <circle cx={lineOfActionX2} cy={lineOfActionY2} r="1.5" fill="#fbbf24" />
              </>
            )}

            {/* Pinion path group */}
            <g id="pinion-group" ref={pinionRef}>
              <path
                d={getPathData(pinionPoints)}
                fill="rgba(34, 211, 238, 0.15)"
                stroke="#22d3ee"
                strokeWidth="1.25"
              />
              {/* Draw bore */}
              <circle cx="0" cy="0" r={gearInput.bore1 / 2} fill="#111" stroke="#22d3ee" strokeWidth="0.75" />
            </g>

            {/* Gear path group */}
            <g id="gear-group" ref={gearRef}>
              <path
                d={getPathData(gearPoints)}
                fill="rgba(232, 121, 249, 0.15)"
                stroke="#e879f9"
                strokeWidth="1.25"
              />
              {/* Draw bore */}
              <circle cx="0" cy="0" r={gearInput.bore2 / 2} fill="#111" stroke="#e879f9" strokeWidth="0.75" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
