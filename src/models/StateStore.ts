import type { Difficulty, EngineConstants, MissionDesignExport, Phase, SimulationState } from './Interfaces';

/**
 * Central immutable store (spec §1.1). Actions return a NEW state; listeners re-render.
 * Kept framework-free on purpose (vanilla TS, zero UI framework).
 */

export const PHASES: Phase[] = ['MCR', 'SRR', 'PDR', 'CDR', 'PLAR'];

export function initialState(c: EngineConstants, difficulty: Difficulty = 'engineer'): SimulationState {
  const budget = c.difficulty_levels[difficulty].budget_usd;
  return {
    currentPhase: 'MCR', simulationHour: 0, isSimulationRunning: false,
    difficulty, seed: c.simulation.default_seed, teamMode: false, activeRole: null, roleSignOffs: {},
    missionObjective: null,
    selectedSite: null, selectedTrajectory: 'direct', selectedBus: 'lander_bus_standard',
    selectedLaunchVehicle: null, selectedLaunchpad: null, padDistanceM: null, selectedMast: null,
    selectedBattery: null, selectedComm: null, selectedStorage: null, selectedLogistics: null,
    selectedUtilityLink: null, drillHeaterW: c.simulation.min_drill_heater_w, selectedInstruments: ['trident_drill'], faultProtection: false,
    iceProspecting: false, selectedDrillOption: null, missionChallenges: [], selectedNightPower: null,
    allocatedBudgetUSD: budget, remainingBudgetUSD: budget, totalWetMassKg: 0,
    telemetryLog: [], gateResults: {}, userHypotheses: {}, completedQuests: [],
  };
}

/** The reference design used by tests and the "show me a working mission" button. */
export const REFERENCE_DESIGN: MissionDesignExport['design'] = {
  missionObjective: 'Assay at least 1,000 kg of polar water ice in one year',
  selectedSite: 'shackleton_ridge', selectedTrajectory: 'direct', selectedBus: 'lander_bus_standard',
  selectedLaunchVehicle: 'lv_medium_reusable', selectedLaunchpad: 'pad_elevated_45deg', padDistanceM: 800,
  selectedMast: 'mast_10m_vsat', selectedBattery: 'batt_liion_8kwh', selectedComm: 'dte_xband',
  selectedStorage: 'ssmm_128gb', selectedLogistics: 'hts_maglev_guideway', selectedUtilityLink: 'laser_power_beaming',
  drillHeaterW: 35, selectedInstruments: ['trident_drill', 'ndl', 'neutron_spec_radiometer'], userHypotheses: {},
  iceProspecting: false, selectedDrillOption: null, missionChallenges: [], selectedNightPower: null,
};

export type Listener = (s: SimulationState) => void;

export class StateStore {
  private state: SimulationState;
  private listeners = new Set<Listener>();

  constructor(initial: SimulationState) { this.state = Object.freeze({ ...initial }); }

  get(): SimulationState { return this.state; }

  update(patch: Partial<SimulationState>): void {
    this.state = Object.freeze({ ...this.state, ...patch });
    for (const l of this.listeners) l(this.state);
  }

  subscribe(l: Listener): () => void { this.listeners.add(l); l(this.state); return () => this.listeners.delete(l); }

  /** REQ-007 export. */
  exportDesign(teamName?: string): MissionDesignExport {
    const s = this.state;
    return {
      format: 'space-mission-simulator/design', version: 1, createdAt: new Date().toISOString(), teamName,
      difficulty: s.difficulty, seed: s.seed,
      design: {
        missionObjective: s.missionObjective, selectedSite: s.selectedSite, selectedTrajectory: s.selectedTrajectory,
        selectedBus: s.selectedBus, selectedLaunchVehicle: s.selectedLaunchVehicle, selectedLaunchpad: s.selectedLaunchpad,
        padDistanceM: s.padDistanceM, selectedMast: s.selectedMast, selectedBattery: s.selectedBattery,
        selectedComm: s.selectedComm, selectedStorage: s.selectedStorage, selectedLogistics: s.selectedLogistics,
        selectedUtilityLink: s.selectedUtilityLink, drillHeaterW: s.drillHeaterW, faultProtection: s.faultProtection,
        iceProspecting: s.iceProspecting, selectedDrillOption: s.selectedDrillOption,
        missionChallenges: [...s.missionChallenges], selectedNightPower: s.selectedNightPower,
        selectedInstruments: [...s.selectedInstruments], userHypotheses: { ...s.userHypotheses },
      },
    };
  }

  /** REQ-007 import (validates the envelope; unknown ids surface later as "missing" choices). */
  importDesign(blob: unknown): void {
    const b = blob as Partial<MissionDesignExport>;
    if (b?.format !== 'space-mission-simulator/design' || b.version !== 1 || !b.design) throw new Error('Not a mission design file (v1).');
    this.update({ iceProspecting: false, selectedDrillOption: null, missionChallenges: [], selectedNightPower: null, ...b.design, difficulty: b.difficulty ?? this.state.difficulty, seed: b.seed ?? this.state.seed, gateResults: {}, telemetryLog: [] });
  }

  /** Share via URL hash (async team play / compare). */
  toShareHash(): string { return '#design=' + btoa(unescape(encodeURIComponent(JSON.stringify(this.exportDesign())))); }

  static fromShareHash(hash: string): MissionDesignExport | null {
    const m = /#design=(.+)$/.exec(hash);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch { return null; }
  }
}
