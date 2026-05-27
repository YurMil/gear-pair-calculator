import { inv } from './spurGeometry';
import type { Point2D } from './types';
export type { Point2D } from './types';

/**
 * Generates the coordinates of a single tooth profile.
 * The profile is centered around the positive X-axis (angle = 0).
 * Returns points on the left flank (from root to tip), the tip, and the right flank (from tip to root).
 */
export function generateSingleToothProfile(
  z: number,
  m: number,
  alphaDeg: number,
  x: number,
  ha_star: number,
  hf_star: number,
  deltaY: number, // tip reduction
  numFlankPoints: number = 15
): Point2D[] {
  const alphaRad = (alphaDeg * Math.PI) / 180;
  const r = (m * z) / 2;
  const rb = r * Math.cos(alphaRad);
  const ha = (ha_star + x - deltaY) * m;
  const hf = (hf_star - x) * m;
  const ra = r + ha;
  const rf = r - hf;

  const s = m * (Math.PI / 2 + 2 * x * Math.tan(alphaRad));
  const psi = s / r; // angular thickness at pitch circle

  // Angle where involute starts at base circle
  const thetaStart = psi / 2 + inv(alphaRad);

  const points: Point2D[] = [];

  const getLeftFlankAngle = (radius: number): number => {
    if (radius <= rb) {
      return thetaStart; // radial line below base circle
    }
    const phi = Math.acos(rb / radius);
    return thetaStart - inv(phi);
  };

  // 1. Left flank (from root to outside circle)
  const rStart = rf;
  const rEnd = ra;
  
  // Decide split between radial part (rf to rb) and involute part (rb to ra)
  const flankPoints: Point2D[] = [];
  
  if (rf < rb) {
    const numRadial = Math.max(3, Math.round(numFlankPoints * 0.2));
    const numInvolute = numFlankPoints - numRadial;

    // Radial part
    for (let i = 0; i < numRadial; i++) {
      const radius = rf + (rb - rf) * (i / numRadial);
      const angle = getLeftFlankAngle(radius);
      flankPoints.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }

    // Involute part
    for (let i = 0; i <= numInvolute; i++) {
      const radius = rb + (ra - rb) * (i / numInvolute);
      const angle = getLeftFlankAngle(radius);
      flankPoints.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
  } else {
    // All involute
    for (let i = 0; i <= numFlankPoints; i++) {
      const radius = rf + (ra - rf) * (i / numFlankPoints);
      const angle = getLeftFlankAngle(radius);
      flankPoints.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
  }

  // 2. Mirror flank points to make the right flank (from tip to root)
  const rightFlank = flankPoints
    .map((p) => ({
      x: p.x,
      y: -p.y, // mirror across X-axis
    }))
    .reverse();

  // Combine left flank and right flank
  // The last point of flankPoints is the tip on the left, and the first of rightFlank is the tip on the right.
  // We return them as a continuous profile from root-left to root-right.
  return [...flankPoints, ...rightFlank];
}

/**
 * Generates the full 2D profile of a gear as a closed loop of points.
 */
export function generateGearProfile(
  z: number,
  m: number,
  alphaDeg: number,
  x: number,
  ha_star: number,
  hf_star: number,
  deltaY: number,
  numFlankPoints: number = 10,
  numRootPoints: number = 4
): Point2D[] {
  const toothProfile = generateSingleToothProfile(z, m, alphaDeg, x, ha_star, hf_star, deltaY, numFlankPoints);
  const hf = (hf_star - x) * m;
  const rf = (m * z) / 2 - hf;

  const pitchAngle = (2 * Math.PI) / z;
  const fullProfile: Point2D[] = [];

  for (let i = 0; i < z; i++) {
    const angleOffset = i * pitchAngle;
    const cosO = Math.cos(angleOffset);
    const sinO = Math.sin(angleOffset);

    // Rotate tooth profile to the current tooth index position
    const rotatedTooth = toothProfile.map((p) => ({
      x: p.x * cosO - p.y * sinO,
      y: p.x * sinO + p.y * cosO,
    }));

    fullProfile.push(...rotatedTooth);

    // Connect this tooth's end (root right) to the next tooth's start (root left)
    const nextAngleOffset = (i + 1) * pitchAngle;
    const nextRotatedToothStart = {
      x: toothProfile[0].x * Math.cos(nextAngleOffset) - toothProfile[0].y * Math.sin(nextAngleOffset),
      y: toothProfile[0].x * Math.sin(nextAngleOffset) + toothProfile[0].y * Math.cos(nextAngleOffset),
    };

    const currentToothEnd = rotatedTooth[rotatedTooth.length - 1];

    const startAngle = Math.atan2(currentToothEnd.y, currentToothEnd.x);
    let endAngle = Math.atan2(nextRotatedToothStart.y, nextRotatedToothStart.x);

    // Adjust angles for continuous interpolation
    if (endAngle < startAngle) {
      endAngle += 2 * Math.PI;
    }

    // Generate root gap arc points at radius rf
    for (let j = 1; j < numRootPoints; j++) {
      const t = j / numRootPoints;
      const angle = startAngle + (endAngle - startAngle) * t;
      fullProfile.push({
        x: rf * Math.cos(angle),
        y: rf * Math.sin(angle),
      });
    }
  }

  return fullProfile;
}
