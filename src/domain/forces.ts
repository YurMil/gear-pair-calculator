import type { GearPairCalculated, LoadInput, ForcesResult } from './types';

export function calculateForces(
  geometry: GearPairCalculated,
  load: LoadInput
): ForcesResult {
  const { aw, alphaWRad, pinion } = geometry;
  const { speed1, torque1 } = load;

  // Operating pitch diameter of pinion: dw1 = 2 * aw * z1 / (z1 + z2)
  const z1 = geometry.pinion.z;
  const z2 = geometry.gear.z;
  const dw1 = (2 * aw * z1) / (z1 + z2);

  // Linear speed (pitch line velocity) v = pi * dw1 * n1 / 60000 [m/s]
  const v = (Math.PI * dw1 * speed1) / 60000;

  // Tangential force Ft = (2 * torque1 * 1000) / dw1 [N] (torque is in N*m, dw1 is in mm)
  // If torque or speed is 0, forces are 0
  let Ft = 0;
  if (dw1 > 0 && torque1 > 0) {
    Ft = (2 * torque1 * 1000) / dw1;
  }

  // Radial force Fr = Ft * tan(alphaW)
  const Fr = Ft * Math.tan(alphaWRad);

  // Normal force Fn = Ft / cos(alphaW)
  const Fn = Ft / Math.cos(alphaWRad);

  // Power P = T1 * n1 / 9550 [kW] or exactly P = 2*pi*n1*T1 / 60000 [kW]
  const power = (2 * Math.PI * speed1 * torque1) / 60000;

  return {
    v,
    Ft,
    Fr,
    Fn,
    power,
  };
}
