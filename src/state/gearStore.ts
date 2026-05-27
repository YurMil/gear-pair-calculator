import { create } from 'zustand';
import type {
  GearInput,
  LoadInput,
  MaterialInput,
  ProjectMetadata,
  CalculationResult,
  CandidateProposal,
  SearchOptions
} from '../domain/types';
import {
  calculateSpurGearPair,
  DEFAULT_GEAR_INPUT,
  DEFAULT_LOAD_INPUT,
  DEFAULT_MATERIAL_INPUT
} from '../domain/gearPair';
import { searchCandidates } from '../domain/ratioSearch';

export interface GearStore {
  metadata: ProjectMetadata;
  gearInput: GearInput;
  loadInput: LoadInput;
  materialInput: MaterialInput;
  
  // UI states
  visualMode: '2d' | '3d';
  activeTab: 'dimensions' | 'forces' | 'strength' | 'ratioSearch' | 'validation';
  isAnimating: boolean;
  animationSpeed: number; // 0.1 to 2.0
  rotationAngle: number; // current angle for animation
  
  // Ratio search
  searchOptions: SearchOptions;
  searchResults: CandidateProposal[];
  
  // Actions
  setMetadata: (meta: Partial<ProjectMetadata>) => void;
  setGearInput: (input: Partial<GearInput>) => void;
  setLoadInput: (input: Partial<LoadInput>) => void;
  setMaterialInput: (input: Partial<MaterialInput>) => void;
  setVisualMode: (mode: '2d' | '3d') => void;
  setActiveTab: (tab: 'dimensions' | 'forces' | 'strength' | 'ratioSearch' | 'validation') => void;
  setIsAnimating: (anim: boolean) => void;
  setAnimationSpeed: (speed: number) => void;
  updateRotationAngle: (delta: number) => void;
  
  setSearchOptions: (opts: Partial<SearchOptions>) => void;
  runRatioSearch: () => void;
  applyCandidate: (candidate: CandidateProposal) => void;
  
  // Derived selector
  getCalculatedResult: () => CalculationResult;
}

export const useGearStore = create<GearStore>((set, get) => ({
  metadata: {
    projectName: 'Gearbox Sizing Project',
    engineerName: 'Engineer',
    date: new Date().toISOString().split('T')[0],
    pinionPartNum: 'PINION-01',
    gearPartNum: 'GEAR-01',
  },
  gearInput: DEFAULT_GEAR_INPUT,
  loadInput: DEFAULT_LOAD_INPUT,
  materialInput: DEFAULT_MATERIAL_INPUT,
  
  visualMode: '2d',
  activeTab: 'dimensions',
  isAnimating: true,
  animationSpeed: 0.05, // low speed by default
  rotationAngle: 0,
  
  searchOptions: {
    ratioTarget: 2.0,
    centerDistanceTarget: 60,
    centerDistanceTol: 5.0,
    minTeeth: 12,
    maxTeeth: 120,
    minModule: 1.0,
    maxModule: 6.0,
  },
  searchResults: [],

  setMetadata: (meta) => set((state) => ({ metadata: { ...state.metadata, ...meta } })),
  setGearInput: (input) => set((state) => ({ gearInput: { ...state.gearInput, ...input } })),
  setLoadInput: (input) => set((state) => ({ loadInput: { ...state.loadInput, ...input } })),
  setMaterialInput: (input) => set((state) => ({ materialInput: { ...state.materialInput, ...input } })),
  setVisualMode: (mode) => set({ visualMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsAnimating: (anim) => set({ isAnimating: anim }),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
  updateRotationAngle: (delta) => set((state) => {
    const input = state.gearInput;
    const load = state.loadInput;
    // Pinion speed in RPM -> degrees per second:
    // rpm * 360 / 60 = rpm * 6
    // delta is in seconds
    const speedDegPerSec = load.speed1 * 6; 
    const angleDelta = state.isAnimating ? (speedDegPerSec * delta * state.animationSpeed) : 0;
    return { rotationAngle: (state.rotationAngle + angleDelta) % 360 };
  }),
  
  setSearchOptions: (opts) => set((state) => ({ searchOptions: { ...state.searchOptions, ...opts } })),
  runRatioSearch: () => {
    const opts = get().searchOptions;
    const results = searchCandidates(opts);
    set({ searchResults: results });
  },
  applyCandidate: (candidate) => set((state) => ({
    gearInput: {
      ...state.gearInput,
      z1: candidate.z1,
      z2: candidate.z2,
      module: candidate.module,
      x1: 0, // Reset profile shifts to standard initially
      x2: 0,
    },
    activeTab: 'dimensions', // Go back to results screen
  })),
  
  getCalculatedResult: () => {
    const state = get();
    return calculateSpurGearPair(
      state.metadata,
      state.gearInput,
      state.loadInput,
      state.materialInput
    );
  }
}));
