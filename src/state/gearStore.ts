import { create } from 'zustand';
import type {
  GearInput,
  LoadInput,
  MaterialInput,
  ProjectMetadata,
  CandidateProposal,
  SearchOptions,
} from '../domain/types';
import {
  DEFAULT_GEAR_INPUT,
  DEFAULT_LOAD_INPUT,
  DEFAULT_MATERIAL_INPUT,
} from '../domain/gearPair';
import { searchCandidates } from '../domain/ratioSearch';

export type DesignMode = 'check' | 'ratio';
export type VisualMode = '2d' | '3d';
export type ActiveTab = 'dimensions' | 'forces' | 'strength' | 'ratioSearch' | 'validation';

export interface GearStore {
  metadata: ProjectMetadata;
  gearInput: GearInput;
  loadInput: LoadInput;
  materialInput: MaterialInput;

  // UI state
  designMode: DesignMode;
  visualMode: VisualMode;
  activeTab: ActiveTab;
  isAnimating: boolean;
  animationSpeed: number;

  // Ratio search
  searchOptions: SearchOptions;
  searchResults: CandidateProposal[];

  // Actions
  setMetadata: (meta: Partial<ProjectMetadata>) => void;
  setGearInput: (input: Partial<GearInput>) => void;
  setLoadInput: (input: Partial<LoadInput>) => void;
  setMaterialInput: (input: Partial<MaterialInput>) => void;

  setDesignMode: (mode: DesignMode) => void;
  setVisualMode: (mode: VisualMode) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setIsAnimating: (anim: boolean) => void;
  setAnimationSpeed: (speed: number) => void;

  setSearchOptions: (opts: Partial<SearchOptions>) => void;
  runRatioSearch: () => void;
  applyCandidate: (candidate: CandidateProposal) => void;

  importSession: (session: {
    metadata: ProjectMetadata;
    gearInput: GearInput;
    loadInput: LoadInput;
    materialInput: MaterialInput;
  }) => void;
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

  designMode: 'check',
  visualMode: '2d',
  activeTab: 'dimensions',
  isAnimating: true,
  animationSpeed: 0.05,

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

  setDesignMode: (mode) => set({ designMode: mode }),
  setVisualMode: (mode) => set({ visualMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsAnimating: (anim) => set({ isAnimating: anim }),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),

  setSearchOptions: (opts) => set((state) => ({ searchOptions: { ...state.searchOptions, ...opts } })),
  runRatioSearch: () => {
    const opts = get().searchOptions;
    set({ searchResults: searchCandidates(opts) });
  },
  applyCandidate: (candidate) =>
    set((state) => ({
      gearInput: {
        ...state.gearInput,
        z1: candidate.z1,
        z2: candidate.z2,
        module: candidate.module,
        x1: 0,
        x2: 0,
      },
      designMode: 'check',
      activeTab: 'dimensions',
    })),

  importSession: (session) =>
    set((state) => ({
      metadata: { ...state.metadata, ...session.metadata },
      gearInput: { ...state.gearInput, ...session.gearInput },
      loadInput: { ...state.loadInput, ...session.loadInput },
      materialInput: { ...state.materialInput, ...session.materialInput },
    })),
}));
