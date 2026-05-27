import type { GearInput, GearCalculatedParams, GearPairCalculated, MaterialInput } from './types';

// Involute function: inv(x) = tan(x) - x
export function inv(radians: number): number {
  return Math.tan(radians) - radians;
}

// Solver for operating pressure angle using Newton-Raphson method
export function solveAlphaW(alpha: number, x1: number, x2: number, z1: number, z2: number): number {
  const alphaRad = (alpha * Math.PI) / 180;
  const invAlpha = inv(alphaRad);
  const invAlphaW = invAlpha + 2 * Math.tan(alphaRad) * ((x1 + x2) / (z1 + z2));
  
  if (Math.abs(x1 + x2) < 1e-7) {
    return alphaRad;
  }

  // Newton-Raphson search
  let theta = alphaRad; // initial guess
  for (let i = 0; i < 20; i++) {
    const f = inv(theta) - invAlphaW;
    const df = Math.tan(theta) * Math.tan(theta); // derivative of tan(theta) - theta is tan^2(theta)
    if (Math.abs(df) < 1e-9) break;
    
    const delta = f / df;
    theta = theta - delta;
    if (Math.abs(delta) < 1e-8) {
      break;
    }
  }
  return theta;
}

// Calculate tooth thickness at pitch circle
export function calculateToothThickness(m: number, alphaRad: number, x: number): number {
  // s = m * (pi / 2 + 2 * x * tan(alpha))
  return m * (Math.PI / 2 + 2 * x * Math.tan(alphaRad));
}

// Calculate estimated gear mass in kg
export function estimateMass(
  d: number,
  faceWidth: number,
  bore: number,
  hubD: number,
  hubL: number,
  density: number
): number {
  const rOuter = d / 2;
  const rBore = bore / 2;
  const rHub = hubD / 2;

  // Main gear body (disk approximation)
  const bodyVol = Math.PI * (rOuter * rOuter - rBore * rBore) * faceWidth;

  // Hub volume
  let hubVol = 0;
  if (hubD > bore && hubL > 0) {
    hubVol = Math.PI * (rHub * rHub - rBore * rBore) * hubL;
  }

  const totalVolMm3 = bodyVol + hubVol; // in mm3
  const totalVolM3 = totalVolMm3 * 1e-9; // convert to m3
  return totalVolM3 * density; // in kg
}

export function calculateSpurGeometry(
  input: GearInput,
  material: MaterialInput
): GearPairCalculated {
  const {
    module: m,
    pressureAngle: alpha,
    z1,
    z2,
    faceWidth: b,
    x1,
    x2,
    clearanceCoeff: c_star,
    addendumCoeff: ha_star,
    dedendumCoeff: hf_star,
    bore1,
    bore2,
    hubD1,
    hubD2,
    hubL1,
    hubL2,
  } = input;

  const alphaRad = (alpha * Math.PI) / 180;
  
  // 1. Pitch diameters
  const d1 = m * z1;
  const d2 = m * z2;

  // 2. Base diameters
  const db1 = d1 * Math.cos(alphaRad);
  const db2 = d2 * Math.cos(alphaRad);

  // 3. Center distance
  const a = (d1 + d2) / 2;

  // 4. Operating pressure angle
  const alphaWRad = solveAlphaW(alpha, x1, x2, z1, z2);
  const alphaWDeg = (alphaWRad * 180) / Math.PI;

  // 5. Operating center distance
  const aw = a * (Math.cos(alphaRad) / Math.cos(alphaWRad));

  // 6. Coefficients
  const y = (aw - a) / m;
  const deltaY = (x1 + x2) - y;

  // 7. Addenda and Dedenda
  const ha1 = (ha_star + x1 - deltaY) * m;
  const ha2 = (ha_star + x2 - deltaY) * m;
  const hf1 = (hf_star - x1) * m;
  const hf2 = (hf_star - x2) * m;

  // 8. Outside and Root diameters
  const da1 = d1 + 2 * ha1;
  const da2 = d2 + 2 * ha2;
  const df1 = d1 - 2 * hf1;
  const df2 = d2 - 2 * hf2;

  // 9. Tooth thicknesses
  const s1 = calculateToothThickness(m, alphaRad, x1);
  const s2 = calculateToothThickness(m, alphaRad, x2);

  // 10. Estimated masses
  const mass1 = estimateMass(d1, b, bore1, hubD1, hubL1, material.density1);
  const mass2 = estimateMass(d2, b, bore2, hubD2, hubL2, material.density2);

  // 11. Undercut limit
  // z_min = 2 * ha_star / sin^2(alpha)
  const undercutLimit = (2 * ha_star) / (Math.sin(alphaRad) * Math.sin(alphaRad));

  // 12. Transverse contact ratio (epsilon_alpha)
  // epsilon = [sqrt(ra1^2 - rb1^2) + sqrt(ra2^2 - rb2^2) - aw * sin(alphaW)] / (pi * m * cos(alpha))
  const ra1 = da1 / 2;
  const rb1 = db1 / 2;
  const ra2 = da2 / 2;
  const rb2 = db2 / 2;
  
  let contactRatio = 0;
  const term1Sq = ra1 * ra1 - rb1 * rb1;
  const term2Sq = ra2 * ra2 - rb2 * rb2;
  if (term1Sq >= 0 && term2Sq >= 0) {
    const numer = Math.sqrt(term1Sq) + Math.sqrt(term2Sq) - aw * Math.sin(alphaWRad);
    const denom = Math.PI * m * Math.cos(alphaRad);
    contactRatio = numer / denom;
  }

  const pinionParams: GearCalculatedParams = {
    z: z1,
    m,
    d: d1,
    db: db1,
    da: da1,
    df: df1,
    ha: ha1,
    hf: hf1,
    s: s1,
    mass: mass1,
  };

  const gearParams: GearCalculatedParams = {
    z: z2,
    m,
    d: d2,
    db: db2,
    da: da2,
    df: df2,
    ha: ha2,
    hf: hf2,
    s: s2,
    mass: mass2,
  };

  return {
    pinion: pinionParams,
    gear: gearParams,
    ratio: z2 / z1,
    invAlpha: inv(alphaRad),
    alphaRad,
    alphaWRad,
    alphaW: alphaWDeg,
    a,
    aw,
    y,
    deltaY,
    contactRatio,
    undercutLimit,
  };
}
