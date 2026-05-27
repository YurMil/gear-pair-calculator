import { generateGearProfile, Point2D } from '../domain/involute';
import type { CalculationResult } from '../domain/types';

// Match the resolution used by 2D/3D previews so what the engineer sees on-screen
// matches what their CAD package will import.
const PROFILE_FLANK_POINTS = 24;
const PROFILE_ROOT_POINTS = 8;

const buildDxfHeader = () => {
  return [
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    '6',
    '0',
    'LAYER',
    '2',
    'GEAR_PROFILE',
    '70',
    '0',
    '62',
    '7',
    '6',
    'CONTINUOUS',
    '0',
    'LAYER',
    '2',
    'PITCH_CIRCLE',
    '70',
    '0',
    '62',
    '4', // cyan
    '6',
    'DASHED',
    '0',
    'LAYER',
    '2',
    'BASE_CIRCLE',
    '70',
    '0',
    '62',
    '1', // red
    '6',
    'DASHED',
    '0',
    'LAYER',
    '2',
    'ROOT_CIRCLE',
    '70',
    '0',
    '62',
    '3', // green
    '6',
    'CONTINUOUS',
    '0',
    'LAYER',
    '2',
    'OUTSIDE_CIRCLE',
    '70',
    '0',
    '62',
    '6', // magenta
    '6',
    'CONTINUOUS',
    '0',
    'LAYER',
    '2',
    'BORE',
    '70',
    '0',
    '62',
    '7',
    '6',
    'CONTINUOUS',
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
  ].join('\n');
};

const buildDxfCircle = (layer: string, cx: number, cy: number, r: number) => {
  return [
    '0',
    'CIRCLE',
    '8',
    layer,
    '10',
    cx.toFixed(4),
    '20',
    cy.toFixed(4),
    '30',
    '0.0',
    '40',
    r.toFixed(4),
    '',
  ].join('\n');
};

const buildDxfLwPolyline = (layer: string, points: Point2D[], closed: boolean = true) => {
  const parts = [
    '0',
    'LWPOLYLINE',
    '8',
    layer,
    '90',
    points.length.toString(),
    '70',
    closed ? '1' : '0',
  ];

  points.forEach((p) => {
    parts.push('10', p.x.toFixed(4), '20', p.y.toFixed(4));
  });

  parts.push('');
  return parts.join('\n');
};

// Closed periodic planar cubic SPLINE built from fit points.
// AutoCAD, FreeCAD, BricsCAD and SolidWorks all interpolate the curve from these
// fit points (control points + knot vector are computed by the receiver).
// Flag bits: 1 = closed, 2 = periodic, 8 = planar → 11 for closed planar periodic.
const buildDxfSplineFitPoints = (layer: string, points: Point2D[], closed: boolean = true) => {
  // Defensive: if the caller passed a closed polyline that explicitly repeats the
  // start as the last fit point, drop the duplicate. A zero-distance interval would
  // make some CAD importers produce a degenerate knot vector or refuse the import.
  let fitPoints = points;
  if (closed && points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) < 1e-5) {
      fitPoints = points.slice(0, -1);
    }
  }

  const flag = closed ? 11 : 8;
  const parts: string[] = [
    '0',
    'SPLINE',
    '8',
    layer,
    '100',
    'AcDbEntity',
    '100',
    'AcDbSpline',
    '70',
    flag.toString(),
    '71',
    '3', // cubic degree
    '72',
    '0', // 0 knots provided — CAD computes them
    '73',
    '0', // 0 control points provided
    '74',
    fitPoints.length.toString(),
    '42',
    '0.0000001',
    '43',
    '0.0000001',
    '44',
    '0.0000000001',
  ];

  // Fit points use group codes 11/21/31.
  for (const p of fitPoints) {
    parts.push('11', p.x.toFixed(6), '21', p.y.toFixed(6), '31', '0.0');
  }

  parts.push('');
  return parts.join('\n');
};

const buildDxfText = (layer: string, text: string, x: number, y: number, height: number = 3.5) => {
  return [
    '0',
    'TEXT',
    '8',
    layer,
    '10',
    x.toFixed(4),
    '20',
    y.toFixed(4),
    '30',
    '0.0',
    '40',
    height.toFixed(2),
    '1',
    text,
    '',
  ].join('\n');
};

const buildDxfLine = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
  return [
    '0',
    'LINE',
    '8',
    layer,
    '10',
    x1.toFixed(4),
    '20',
    y1.toFixed(4),
    '30',
    '0.0',
    '11',
    x2.toFixed(4),
    '21',
    y2.toFixed(4),
    '31',
    '0.0',
    '',
  ].join('\n');
};

export function exportSingleGearDxf(
  z: number,
  m: number,
  pressureAngle: number,
  x: number,
  ha_star: number,
  hf_star: number,
  deltaY: number,
  bore: number,
  label: string
): string {
  const r = (m * z) / 2;
  const rb = r * Math.cos((pressureAngle * Math.PI) / 180);
  const ra = r + (ha_star + x - deltaY) * m;
  const rf = r - (hf_star - x) * m;

  // Generate high resolution profile points
  const profilePoints = generateGearProfile(
    z,
    m,
    pressureAngle,
    x,
    ha_star,
    hf_star,
    deltaY,
    PROFILE_FLANK_POINTS,
    PROFILE_ROOT_POINTS
  );

  let dxf = buildDxfHeader();
  dxf += '\n0\nSECTION\n2\nENTITIES\n';

  // 1. Profile Outline — smooth SPLINE so downstream CAD treats the involute as a curve, not a polyline.
  dxf += buildDxfSplineFitPoints('GEAR_PROFILE', profilePoints, true);

  // 2. Bore Hole
  if (bore > 0) {
    dxf += buildDxfCircle('BORE', 0, 0, bore / 2);
  }

  // 3. Helper Reference Circles
  dxf += buildDxfCircle('PITCH_CIRCLE', 0, 0, r);
  dxf += buildDxfCircle('BASE_CIRCLE', 0, 0, rb);
  dxf += buildDxfCircle('ROOT_CIRCLE', 0, 0, rf);
  dxf += buildDxfCircle('OUTSIDE_CIRCLE', 0, 0, ra);

  // 4. Center Mark Lines
  const markSize = Math.max(ra * 0.1, 5);
  dxf += buildDxfLine('GEAR_PROFILE', -markSize, 0, markSize, 0);
  dxf += buildDxfLine('GEAR_PROFILE', 0, -markSize, 0, markSize);

  // 5. Notes
  dxf += buildDxfText('GEAR_PROFILE', `GEAR: ${label}`, -ra * 0.9, ra * 1.05, 3.5);
  dxf += buildDxfText('GEAR_PROFILE', `Teeth Count z = ${z}`, -ra * 0.9, ra * 0.9, 2.5);
  dxf += buildDxfText('GEAR_PROFILE', `Module m = ${m} mm`, -ra * 0.9, ra * 0.78, 2.5);
  dxf += buildDxfText('GEAR_PROFILE', `Pressure Angle = ${pressureAngle} deg`, -ra * 0.9, ra * 0.66, 2.5);
  dxf += buildDxfText('GEAR_PROFILE', `Profile Shift x = ${x.toFixed(3)}`, -ra * 0.9, ra * 0.54, 2.5);

  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

export function exportGearPairLayoutDxf(result: CalculationResult): string {
  const { geometry, gearInput } = result;
  const { pinion, gear, aw } = geometry;

  const pinionPoints = generateGearProfile(
    pinion.z,
    pinion.m,
    gearInput.pressureAngle,
    gearInput.x1,
    gearInput.addendumCoeff,
    gearInput.dedendumCoeff,
    geometry.deltaY,
    PROFILE_FLANK_POINTS,
    PROFILE_ROOT_POINTS
  );

  const gearBaseAngle = gear.z % 2 === 0 ? Math.PI + Math.PI / gear.z : Math.PI;

  const rawGearPoints = generateGearProfile(
    gear.z,
    gear.m,
    gearInput.pressureAngle,
    gearInput.x2,
    gearInput.addendumCoeff,
    gearInput.dedendumCoeff,
    geometry.deltaY,
    PROFILE_FLANK_POINTS,
    PROFILE_ROOT_POINTS
  );

  // Rotate and translate gear points to position in mesh at (aw, 0)
  const positionedGearPoints = rawGearPoints.map((p) => {
    const xRot = p.x * Math.cos(gearBaseAngle) - p.y * Math.sin(gearBaseAngle);
    const yRot = p.x * Math.sin(gearBaseAngle) + p.y * Math.cos(gearBaseAngle);
    return {
      x: xRot + aw,
      y: yRot,
    };
  });

  let dxf = buildDxfHeader();
  dxf += '\n0\nSECTION\n2\nENTITIES\n';

  // 1. Profile Outlines — smooth SPLINEs.
  dxf += buildDxfSplineFitPoints('GEAR_PROFILE', pinionPoints, true);
  dxf += buildDxfSplineFitPoints('GEAR_PROFILE', positionedGearPoints, true);

  // 2. Bores
  if (gearInput.bore1 > 0) {
    dxf += buildDxfCircle('BORE', 0, 0, gearInput.bore1 / 2);
  }
  if (gearInput.bore2 > 0) {
    dxf += buildDxfCircle('BORE', aw, 0, gearInput.bore2 / 2);
  }

  // 3. Circles
  dxf += buildDxfCircle('PITCH_CIRCLE', 0, 0, pinion.d / 2);
  dxf += buildDxfCircle('PITCH_CIRCLE', aw, 0, gear.d / 2);
  dxf += buildDxfCircle('BASE_CIRCLE', 0, 0, pinion.db / 2);
  dxf += buildDxfCircle('BASE_CIRCLE', aw, 0, gear.db / 2);
  dxf += buildDxfCircle('ROOT_CIRCLE', 0, 0, pinion.df / 2);
  dxf += buildDxfCircle('ROOT_CIRCLE', aw, 0, gear.df / 2);
  dxf += buildDxfCircle('OUTSIDE_CIRCLE', 0, 0, pinion.da / 2);
  dxf += buildDxfCircle('OUTSIDE_CIRCLE', aw, 0, gear.da / 2);

  // 4. Center-to-center dimension line
  dxf += buildDxfLine('GEAR_PROFILE', 0, 0, aw, 0);
  const markSize = 4;
  dxf += buildDxfLine('GEAR_PROFILE', 0, -markSize, 0, markSize);
  dxf += buildDxfLine('GEAR_PROFILE', aw, -markSize, aw, markSize);

  // 5. Dimension text
  dxf += buildDxfText('GEAR_PROFILE', `aw = ${aw.toFixed(3)} mm`, aw / 2 - 12, 4, 3.0);

  // 6. Project summary notes
  dxf += buildDxfText('GEAR_PROFILE', `PROJECT: ${result.metadata.projectName}`, -pinion.da / 2, pinion.da * 0.9, 3.5);
  dxf += buildDxfText('GEAR_PROFILE', `Pinion teeth z1 = ${pinion.z}`, -pinion.da / 2, pinion.da * 0.75, 2.5);
  dxf += buildDxfText('GEAR_PROFILE', `Gear teeth z2 = ${gear.z}`, -pinion.da / 2, pinion.da * 0.63, 2.5);
  dxf += buildDxfText('GEAR_PROFILE', `Module m = ${pinion.m} mm`, -pinion.da / 2, pinion.da * 0.51, 2.5);

  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

export function downloadDxfFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
