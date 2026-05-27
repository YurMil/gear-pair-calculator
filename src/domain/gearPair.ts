import type {
  GearInput,
  LoadInput,
  MaterialInput,
  ProjectMetadata,
  CalculationResult
} from './types';
import { calculateSpurGeometry } from './spurGeometry';
import { calculateForces } from './forces';
import { calculatePreliminaryStrength } from './preliminaryStrength';
import { validateGearPair } from './validation';

export function calculateSpurGearPair(
  metadata: ProjectMetadata,
  gearInput: GearInput,
  loadInput: LoadInput,
  materialInput: MaterialInput
): CalculationResult {
  const geometry = calculateSpurGeometry(gearInput, materialInput);
  const forces = calculateForces(geometry, loadInput);
  const strength = calculatePreliminaryStrength(geometry, gearInput, loadInput, materialInput, forces.Ft);
  const issues = validateGearPair(gearInput, geometry, forces, strength);

  return {
    metadata,
    gearInput,
    loadInput,
    materialInput,
    geometry,
    forces,
    strength,
    issues,
  };
}

export const MATERIAL_PRESETS = [
  { name: 'Structural Steel (S355)', allowableBending: 240, density: 7850 },
  { name: 'Alloy Steel (42CrMo4)', allowableBending: 380, density: 7850 },
  { name: 'Case Hardened Steel (16MnCr5)', allowableBending: 450, density: 7850 },
  { name: 'Stainless Steel (316L)', allowableBending: 190, density: 7980 },
  { name: 'Cast Iron (GG25)', allowableBending: 140, density: 7250 },
  { name: 'Bronze (CuSn12)', allowableBending: 110, density: 8800 },
  { name: 'Nylon / PA6', allowableBending: 45, density: 1150 },
  { name: 'POM / Acetal', allowableBending: 55, density: 1410 }
];

export const DEFAULT_GEAR_INPUT: GearInput = {
  module: 2,
  pressureAngle: 20,
  z1: 20,
  z2: 40,
  faceWidth: 20,
  x1: 0,
  x2: 0,
  backlash: 0.1,
  clearanceCoeff: 0.25,
  addendumCoeff: 1.0,
  dedendumCoeff: 1.25,
  
  bore1: 15,
  bore2: 25,
  hubD1: 25,
  hubD2: 40,
  hubL1: 0,
  hubL2: 0,
  keyway1: false,
  keyway2: false
};

export const DEFAULT_LOAD_INPUT: LoadInput = {
  speed1: 1500,
  torque1: 10, // N*m
  serviceFactor: 1.0,
  efficiency: 0.97
};

export const DEFAULT_MATERIAL_INPUT: MaterialInput = {
  material1: 'Alloy Steel (42CrMo4)',
  material2: 'Alloy Steel (42CrMo4)',
  allowableBending1: 380,
  allowableBending2: 380,
  density1: 7850,
  density2: 7850
};
