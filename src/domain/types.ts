export interface ProjectMetadata {
  projectName: string;
  engineerName: string;
  date: string;
  pinionPartNum: string;
  gearPartNum: string;
}

export interface GearInput {
  module: number;
  pressureAngle: number; // in degrees (e.g. 20)
  z1: number; // teeth count pinion
  z2: number; // teeth count gear
  faceWidth: number; // in mm
  x1: number; // profile shift coefficient pinion
  x2: number; // profile shift coefficient gear
  backlash: number; // in mm
  clearanceCoeff: number; // standard c* = 0.25
  addendumCoeff: number; // standard ha* = 1.0
  dedendumCoeff: number; // standard hf* = 1.25
  
  // body constraints
  bore1: number; // bore diameter pinion
  bore2: number; // bore diameter gear
  hubD1: number; // hub diameter pinion
  hubD2: number; // hub diameter gear
  hubL1: number; // hub length pinion
  hubL2: number; // hub length gear
  keyway1: boolean; // has keyway pinion
  keyway2: boolean; // has keyway gear
}

export interface LoadInput {
  speed1: number; // input speed in rpm (pinion)
  torque1: number; // input torque in N*m (pinion)
  serviceFactor: number; // KA (default 1.0)
  efficiency: number; // eta (default 0.97)
}

export interface MaterialInput {
  material1: string; // preset name
  material2: string; // preset name
  allowableBending1: number; // in MPa
  allowableBending2: number; // in MPa
  density1: number; // in kg/m3 (e.g., 7850 for steel)
  density2: number; // in kg/m3
}

export interface GearCalculatedParams {
  z: number;
  m: number;
  d: number;      // pitch diameter
  db: number;     // base diameter
  da: number;     // outside (addendum) diameter
  df: number;     // root (dedendum) diameter
  ha: number;     // addendum height
  hf: number;     // dedendum height
  s: number;      // tooth thickness at pitch circle
  mass: number;   // estimated mass in kg
}

export interface GearPairCalculated {
  pinion: GearCalculatedParams;
  gear: GearCalculatedParams;
  
  // Operating values
  ratio: number;
  invAlpha: number; // involute of standard pressure angle (rad)
  alphaRad: number; // standard pressure angle (rad)
  alphaWRad: number; // operating pressure angle (rad)
  alphaW: number; // operating pressure angle (deg)
  a: number; // standard center distance (mm)
  aw: number; // operating center distance (mm)
  y: number; // center distance modification coefficient
  deltaY: number; // tooth tip reduction coefficient
  
  contactRatio: number; // transverse contact ratio
  undercutLimit: number; // z limit below which undercut happens
}

export interface ForcesResult {
  v: number; // pitch line velocity (m/s)
  Ft: number; // tangential force (N)
  Fr: number; // radial force (N)
  Fn: number; // normal force (N)
  power: number; // power in kW
}

export interface StrengthResult {
  pinionBendingStress: number; // in MPa
  gearBendingStress: number; // in MPa
  pinionSafetyFactor: number;
  gearSafetyFactor: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  fields?: string[];
  suggestedFix?: string;
}

export interface CalculationResult {
  metadata: ProjectMetadata;
  gearInput: GearInput;
  loadInput: LoadInput;
  materialInput: MaterialInput;
  geometry: GearPairCalculated;
  forces: ForcesResult;
  strength: StrengthResult;
  issues: ValidationIssue[];
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CandidateProposal {
  z1: number;
  z2: number;
  module: number;
  ratio: number;
  ratioError: number;
  centerDistance: number;
  centerDistanceError: number;
  undercutPinion: boolean;
  undercutGear: boolean;
  score: number;
  rank: number;
}

export interface SearchOptions {
  ratioTarget: number;
  centerDistanceTarget?: number;
  centerDistanceTol?: number;
  minTeeth?: number;
  maxTeeth?: number;
  minModule?: number;
  maxModule?: number;
}
