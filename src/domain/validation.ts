import type { GearInput, GearPairCalculated, LoadInput, ForcesResult, StrengthResult, ValidationIssue } from './types';

export function validateGearPair(
  input: GearInput,
  geometry: GearPairCalculated,
  forces: ForcesResult,
  strength: StrengthResult
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const { pinion, gear, contactRatio, undercutLimit } = geometry;

  // 1. Undercut risk
  if (pinion.z < undercutLimit && input.x1 <= 0) {
    issues.push({
      id: 'undercut-pinion',
      severity: 'warning',
      title: 'Pinion Undercutting Risk',
      message: `Pinion tooth count (${pinion.z}) is below the undercut limit (${Math.round(undercutLimit)}). Increase pinion profile shift (x1 > 0) or increase tooth count.`,
      fields: ['x1', 'z1'],
      suggestedFix: 'Set x1 to 0.2 or higher, or increase pinion teeth count to at least 17.',
    });
  }

  if (gear.z < undercutLimit && input.x2 <= 0) {
    issues.push({
      id: 'undercut-gear',
      severity: 'warning',
      title: 'Gear Undercutting Risk',
      message: `Gear tooth count (${gear.z}) is below the undercut limit (${Math.round(undercutLimit)}). Increase gear profile shift (x2 > 0) or increase tooth count.`,
      fields: ['x2', 'z2'],
      suggestedFix: 'Set x2 to 0.2 or higher, or increase gear teeth count to at least 17.',
    });
  }

  // 2. Bore too large for gear body
  const minRimThickness = 2 * input.module;
  if (input.bore1 >= pinion.df - minRimThickness) {
    issues.push({
      id: 'bore-large-pinion',
      severity: 'error',
      title: 'Pinion Bore Too Large',
      message: `Pinion bore (${input.bore1} mm) is too large. The remaining rim thickness is less than the required minimum of 2 * module (${minRimThickness} mm).`,
      fields: ['bore1'],
      suggestedFix: 'Decrease bore diameter or increase pinion teeth count / module to grow the root diameter.',
    });
  }

  if (input.bore2 >= gear.df - minRimThickness) {
    issues.push({
      id: 'bore-large-gear',
      severity: 'error',
      title: 'Gear Bore Too Large',
      message: `Gear bore (${input.bore2} mm) is too large. The remaining rim thickness is less than the required minimum of 2 * module (${minRimThickness} mm).`,
      fields: ['bore2'],
      suggestedFix: 'Decrease bore diameter or increase gear teeth count / module to grow the root diameter.',
    });
  }

  // 3. Contact ratio
  if (contactRatio < 1.0) {
    issues.push({
      id: 'contact-ratio-critical',
      severity: 'error',
      title: 'Discontinuous Engagement',
      message: `The transverse contact ratio (\u03B5\u03B1 = ${contactRatio.toFixed(3)}) is below 1.0. The gears will lose contact during rotation, causing high impact and damage.`,
      fields: ['z1', 'z2', 'pressureAngle'],
      suggestedFix: 'Increase teeth counts z1/z2, decrease pressure angle, or adjust profile shifts x1/x2.',
    });
  } else if (contactRatio < 1.2) {
    issues.push({
      id: 'contact-ratio-low',
      severity: 'warning',
      title: 'Low Contact Ratio',
      message: `The contact ratio (\u03B5\u03B1 = ${contactRatio.toFixed(3)}) is below the recommended minimum of 1.2. The gear set will experience high noise and rapid wear.`,
      fields: ['z1', 'z2', 'pressureAngle'],
      suggestedFix: 'Increase z1/z2 or decrease pressure angle (e.g. to 14.5 degrees) to increase the contact ratio.',
    });
  } else if (contactRatio < 1.4) {
    issues.push({
      id: 'contact-ratio-info',
      severity: 'info',
      title: 'Moderate Contact Ratio',
      message: `The contact ratio (\u03B5\u03B1 = ${contactRatio.toFixed(3)}) is between 1.2 and 1.4. This is acceptable for slow or low-precision applications, but not for high-speed machinery.`,
      fields: [],
    });
  }

  // 4. Circle ordering
  if (pinion.df >= pinion.da || pinion.db >= pinion.da) {
    issues.push({
      id: 'circle-order-pinion',
      severity: 'error',
      title: 'Invalid Pinion Geometry',
      message: 'Pinion root or base circle diameter is larger than or equal to its outside diameter.',
      fields: ['x1', 'module'],
      suggestedFix: 'Decrease profile shift (x1) or adjust clearance coefficients.',
    });
  }

  if (gear.df >= gear.da || gear.db >= gear.da) {
    issues.push({
      id: 'circle-order-gear',
      severity: 'error',
      title: 'Invalid Gear Geometry',
      message: 'Gear root or base circle diameter is larger than or equal to its outside diameter.',
      fields: ['x2', 'module'],
      suggestedFix: 'Decrease profile shift (x2) or adjust clearance coefficients.',
    });
  }

  // 5. Excessive profile shift
  if (input.x1 > 1.5 || input.x1 < -0.8) {
    issues.push({
      id: 'excessive-shift-pinion',
      severity: 'warning',
      title: 'Extreme Pinion Shift',
      message: `Pinion profile shift x1 (${input.x1}) is outside the normal engineering range (-0.5 to +1.0). Tooth profile may be too pointed or undercut.`,
      fields: ['x1'],
      suggestedFix: 'Adjust x1 closer to the range 0.0 to 0.5.',
    });
  }

  if (input.x2 > 1.5 || input.x2 < -0.8) {
    issues.push({
      id: 'excessive-shift-gear',
      severity: 'warning',
      title: 'Extreme Gear Shift',
      message: `Gear profile shift x2 (${input.x2}) is outside the normal engineering range (-0.5 to +1.0). Tooth profile may be too pointed or undercut.`,
      fields: ['x2'],
      suggestedFix: 'Adjust x2 closer to the range 0.0 to 0.5.',
    });
  }

  // 6. Safety factor bending check
  if (strength.pinionSafetyFactor < 1.0) {
    issues.push({
      id: 'strength-pinion-fail',
      severity: 'warning',
      title: 'Pinion Bending Strength Warning',
      message: `Pinion root bending safety factor (${strength.pinionSafetyFactor.toFixed(2)}) is below 1.0 under design load. Tooth breakage may occur.`,
      fields: ['torque1', 'faceWidth', 'material1'],
      suggestedFix: 'Increase module, increase face width, choose a stronger material, or increase profile shift x1.',
    });
  }

  if (strength.gearSafetyFactor < 1.0) {
    issues.push({
      id: 'strength-gear-fail',
      severity: 'warning',
      title: 'Gear Bending Strength Warning',
      message: `Gear root bending safety factor (${strength.gearSafetyFactor.toFixed(2)}) is below 1.0 under design load. Tooth breakage may occur.`,
      fields: ['torque1', 'faceWidth', 'material2'],
      suggestedFix: 'Increase module, increase face width, choose a stronger material, or increase profile shift x2.',
    });
  }

  return issues;
}
