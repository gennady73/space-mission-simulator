import type { Difficulty, EngineConstants, MissionDesignExport } from '../models/Interfaces';

/**
 * Personal best per difficulty (UI review items 5 and 7): the best flown design is kept in this
 * browser only, so a player can try to beat it and compare a new run against it. Nothing here is
 * a game number; the figures are copied from the debrief of the run that set the best.
 */
export interface RunSummary {
  score: number;
  iceKg: number;
  dataCompleteness: number;
  uptimeHours: number;
  minSoCPercent: number;
  costUSD: number;
  lostDay: number | null;
}

export interface BestRun extends RunSummary {
  at: string;
  design: MissionDesignExport;
}

export interface BestOutcome {
  /** The best before this run, or null on the first flight at this difficulty. */
  previous: BestRun | null;
  /** True when this run replaced the stored best. */
  isNew: boolean;
}

/** Minimal storage surface, so tests can pass a Map-backed fake and private windows can fail quietly. */
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** The ice prospecting challenge (D-040) is scored against another target, so it keeps its own best. */
const key = (d: Difficulty, challenge: boolean | string = false) => `lighthouse-best-v1-${d}${challenge === true ? '-ice' : challenge || ''}`;

/** Key suffix for the challenges a design flies (D-040, D-041): each combination keeps its own best. */
export const challengeKey = (design: MissionDesignExport['design']): string =>
  [design.iceProspecting ? 'ice' : '', ...[...(design.missionChallenges ?? [])].sort()].filter(Boolean).map((id) => `-${id}`).join('');

const browserStore = (): KeyValueStore | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function loadBest(difficulty: Difficulty, store: KeyValueStore | null = browserStore(), challenge: boolean | string = false): BestRun | null {
  try {
    const raw = store?.getItem(key(difficulty, challenge));
    if (!raw) return null;
    const best = JSON.parse(raw) as BestRun;
    return typeof best.score === 'number' && best.design?.format === 'space-mission-simulator/design' ? best : null;
  } catch { return null; }
}

/** Record the run when it beats the stored best (ties go to the newer run's cheaper cost). */
export function recordRun(difficulty: Difficulty, run: RunSummary, design: MissionDesignExport, store: KeyValueStore | null = browserStore()): BestOutcome {
  const challenge = challengeKey(design.design);
  const previous = loadBest(difficulty, store, challenge);
  const better = !previous || run.score > previous.score || (run.score === previous.score && run.costUSD < previous.costUSD);
  if (better) {
    try { store?.setItem(key(difficulty, challenge), JSON.stringify({ ...run, at: new Date().toISOString(), design })); } catch { /* storage full or blocked: the run still shows */ }
  }
  return { previous, isNew: better };
}

/** Design keys shown in the comparison, with the catalog that names each choice. */
type DesignKey = keyof MissionDesignExport['design'];
export interface DesignDifference { label: string; mine: string; best: string }

export function designDifferences(c: EngineConstants, mine: MissionDesignExport['design'], best: MissionDesignExport['design']): DesignDifference[] {
  const hw = c.hardware_catalog;
  const named = (table: Record<string, { name: string }>) => (id: unknown) => (typeof id === 'string' ? table[id]?.name ?? id : 'not chosen');
  const rows: [string, DesignKey, (v: unknown) => string][] = [
    ['Landing site', 'selectedSite', named(c.site_catalog)],
    ['Launch vehicle', 'selectedLaunchVehicle', named(hw.launch_vehicles)],
    ['Trajectory', 'selectedTrajectory', named(c.trajectories)],
    ['Landing pad', 'selectedLaunchpad', named(hw.launchpads)],
    ['Pad to mast', 'padDistanceM', (v) => (typeof v === 'number' ? `${v.toLocaleString('en-US')} m` : 'not set')],
    ['Power mast', 'selectedMast', named(hw.power_masts)],
    ['Battery', 'selectedBattery', named(hw.energy_storage)],
    ['Communications', 'selectedComm', named(hw.comm_systems)],
    ['Data storage', 'selectedStorage', named(hw.data_storage)],
    ['Instruments', 'selectedInstruments', (v) => (Array.isArray(v) && v.length ? v.map((id) => hw.science_instruments[id]?.name ?? id).join(', ') : 'none')],
    ['Cold-trap logistics', 'selectedLogistics', named(hw.cold_trap_logistics)],
    ['Power link', 'selectedUtilityLink', named(hw.utility_links)],
    ['Drill heater', 'drillHeaterW', (v) => `${v} W`],
    ['Fault protection', 'faultProtection', (v) => (v ? 'yes' : 'no')],
    ['Night power', 'selectedNightPower', (v) => c.mission_challenges.night_survival.night_power_options[typeof v === 'string' ? v : c.mission_challenges.night_survival.default_night_power]?.name ?? String(v)],
    ['Drill string', 'selectedDrillOption', (v) => c.ice_prospecting.drill_options[typeof v === 'string' ? v : c.ice_prospecting.default_drill_option]?.name ?? String(v)],
  ];
  return rows
    .map(([label, k, show]) => ({ label, mine: show(mine[k]), best: show(best[k]) }))
    .filter((r) => r.mine !== r.best);
}
