import type { GearPairCalculated, GearInput, LoadInput, MaterialInput, StrengthResult } from './types';

// Calculate Lewis Form Factor Y_m (module-based)
// Y_m = pi * y, where y is the standard circular pitch Lewis factor
export function calculateLewisFactor(z: number, pressureAngle: number, x: number): number {
  let y_base = 0;
  
  if (pressureAngle < 17.5) {
    // 14.5 degrees
    y_base = 0.124 - 0.684 / Math.max(z, 5);
  } else if (pressureAngle > 22.5) {
    // 25 degrees
    y_base = 0.175 - 0.95 / Math.max(z, 5);
  } else {
    // Default 20 degrees
    y_base = 0.154 - 0.912 / Math.max(z, 5);
  }

  const Y_m_base = Math.PI * y_base;

  // Profile shift correction: positive shift increases root thickness
  // Approximate multiplier: (1 + 1.2 * x)
  const Y_m = Y_m_base * (1 + 1.2 * x);
  return Math.max(Y_m, 0.05); // ensure it never goes to zero/negative
}

export function calculatePreliminaryStrength(
  geometry: GearPairCalculated,
  input: GearInput,
  load: LoadInput,
  material: MaterialInput,
  Ft: number
): StrengthResult {
  const { pinion, gear, alphaW } = geometry;
  const { serviceFactor: KA } = load;

  const Y_m1 = calculateLewisFactor(pinion.z, alphaW, input.x1);
  const Y_m2 = calculateLewisFactor(gear.z, alphaW, input.x2);

  const faceWidth = input.faceWidth;

  // sigma_b = Ft * KA / (b * m * Y_m)
  let pinionStress = 0;
  let gearStress = 0;

  if (faceWidth > 0 && pinion.m > 0 && Ft > 0) {
    pinionStress = (Ft * KA) / (faceWidth * pinion.m * Y_m1);
    gearStress = (Ft * KA) / (faceWidth * gear.m * Y_m2);
  }

  // Safety Factor SF = sigma_allowable / sigma_b
  const pinionSafetyFactor = pinionStress > 0 ? material.allowableBending1 / pinionStress : 999;
  const gearSafetyFactor = gearStress > 0 ? material.allowableBending2 / gearStress : 999;

  return {
    pinionBendingStress: pinionStress,
    gearBendingStress: gearStress,
    pinionSafetyFactor,
    gearSafetyFactor,
  };
}
