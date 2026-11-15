import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EngineConstants, MissionDesignExport } from '../src/models/Interfaces';
import { designDifferences, loadBest, recordRun, type KeyValueStore, type RunSummary } from '../src/ui/bestRuns';

const c = JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8')) as EngineConstants;
const memory = (): KeyValueStore => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } }; };
const design = (patch: Partial<MissionDesignExport['design']> = {}): MissionDesignExport => ({
  format: 'space-mission-simulator/design', version: 1, createdAt: '2026-11-15T00:00:00Z', difficulty: 'engineer', seed: 1,
  design: {
    missionObjective: null, selectedSite: 'shackleton_ridge', selectedTrajectory: null, selectedBus: null, selectedLaunchVehicle: 'lv_medium_reusable',
    selectedLaunchpad: 'pad_elevated_45deg', padDistanceM: 800, selectedMast: 'mast_10m_vsat', selectedBattery: 'batt_liion_8kwh',
    selectedComm: 'dte_xband', selectedStorage: 'ssmm_128gb', selectedLogistics: 'hts_maglev_guideway', selectedUtilityLink: 'laser_power_beaming',
    drillHeaterW: 40, selectedInstruments: ['ndl'], userHypotheses: {}, ...patch,
  },
});
const run = (score: number, costUSD = 100): RunSummary => ({ score, iceKg: 1, dataCompleteness: 1, uptimeHours: 8760, minSoCPercent: 50, costUSD, lostDay: null });

describe('personal best per difficulty', () => {
  it('first run sets the best, a lower run keeps it, a higher run replaces it', () => {
    const store = memory();
    expect(recordRun('engineer', run(500), design(), store)).toEqual({ previous: null, isNew: true });
    const lower = recordRun('engineer', run(400), design(), store);
    expect(lower.isNew).toBe(false);
    expect(lower.previous?.score).toBe(500);
    expect(recordRun('engineer', run(600), design(), store).isNew).toBe(true);
    expect(loadBest('engineer', store)?.score).toBe(600);
    expect(loadBest('cadet', store)).toBeNull();
  });

  it('a tie goes to the cheaper run', () => {
    const store = memory();
    recordRun('engineer', run(500, 200), design(), store);
    expect(recordRun('engineer', run(500, 300), design(), store).isNew).toBe(false);
    expect(recordRun('engineer', run(500, 100), design(), store).isNew).toBe(true);
  });

  it('survives missing or broken storage', () => {
    expect(recordRun('engineer', run(1), design(), null).isNew).toBe(true);
    const broken: KeyValueStore = { getItem: () => '{not json', setItem: () => { throw new Error('quota'); } };
    expect(loadBest('engineer', broken)).toBeNull();
    expect(recordRun('engineer', run(1), design(), broken).isNew).toBe(true);
  });

  it('lists only the choices that differ, by their catalog names', () => {
    const diffs = designDifferences(c, design().design, design({ selectedBattery: 'batt_liion_4kwh', padDistanceM: 1500 }).design);
    expect(diffs.map((d) => d.label)).toEqual(['Pad to mast', 'Battery']);
    expect(diffs[1].mine).toBe(c.hardware_catalog.energy_storage.batt_liion_8kwh.name);
  });
});
