import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConstants, validateConstants } from '../src/engine/ConstantsLoader';
import { runMission, scoreMission } from '../src/engine/SimulationClock';
import { runDesignGates } from '../src/engine/StageGateValidators';
import {
  dryMassKg, drillPeakW, eclipseEnergy, iceRateKgPerHour, iceTargetKg, isResolved, resolveDesign, totalCostUSD, type ResolvedDesign,
} from '../src/engine/SubsystemEngines';
import { REFERENCE_DESIGN } from '../src/models/StateStore';
import { loadBest, recordRun, type KeyValueStore } from '../src/ui/bestRuns';

/** D-040: ice prospecting challenge (water target, drill strings, thermal extraction). */
const raw = JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8'));
const c = parseConstants(raw);
const ip = c.ice_prospecting;
const budget = c.difficulty_levels.engineer.budget_usd;
const seed = c.simulation.default_seed;

const design = (patch: Partial<typeof REFERENCE_DESIGN> = {}): ResolvedDesign => {
  const r = resolveDesign(c, { ...REFERENCE_DESIGN, ...patch });
  if (!isResolved(r)) throw new Error(r.missing.join(', '));
  return r;
};
const fly = (r: ResolvedDesign) => {
  const gates = runDesignGates(c, r);
  const passed = Object.values(gates).filter((g) => g?.passed).length;
  const result = runMission(c, r, { seed, randomEvents: false });
  return { gates, result, score: scoreMission(c, r, result, passed, budget) };
};
const challenge = { iceProspecting: true } as const;

describe('ice prospecting challenge (D-040)', () => {
  it('leaves the plain game untouched: default string, minimum heater, old normaliser', () => {
    const r = design();
    expect(r.drillOption.id).toBe(ip.default_drill_option);
    expect(iceRateKgPerHour(c, r)).toBe(c.simulation.ice_assay_rate_kg_h);
    expect(iceTargetKg(c, r)).toBe(c.simulation.ice_score_normaliser_kg);
    const explicit = design({ selectedDrillOption: ip.default_drill_option });
    expect(dryMassKg(explicit)).toBe(dryMassKg(r));
    expect(totalCostUSD(explicit)).toBe(totalCostUSD(r));
    expect(drillPeakW(explicit)).toBe(drillPeakW(r));
  });

  it('the reference design falls short of the water target, so the challenge asks for a new design', () => {
    const plain = fly(design());
    const ch = fly(design(challenge));
    expect(ch.result.iceKg).toBe(plain.result.iceKg);
    expect(ch.result.iceKg).toBeLessThan(ip.water_target_kg);
    expect(ch.score.total).toBeLessThan(plain.score.total);
  });

  it('a longer drill string adds its mass, cost and peak power, and yields more ice per hour', () => {
    const base = design(challenge);
    for (const opt of Object.values(ip.drill_options)) {
      const r = design({ ...challenge, selectedDrillOption: opt.id });
      expect(dryMassKg(r) - dryMassKg(base)).toBeCloseTo(opt.mass_kg, 6);
      expect(totalCostUSD(r) - totalCostUSD(base)).toBeCloseTo(opt.cost_usd, 6);
      expect(drillPeakW(r) - drillPeakW(base)).toBeCloseTo(opt.extra_peak_power_w, 6);
      expect(iceRateKgPerHour(c, r)).toBeCloseTo(c.simulation.ice_assay_rate_kg_h * opt.ice_yield_factor, 9);
    }
  });

  it('the deepest string is too much for the laser link (fails CDR) and reaches the target on the cable', () => {
    const onLaser = fly(design({ ...challenge, selectedDrillOption: 'string_3m' }));
    expect(onLaser.gates.CDR?.reasonCode).toBe('ERR_CDR_LINK_POWER_DEFICIT');
    expect(onLaser.result.iceKg).toBe(0);
    const onCable = fly(design({ ...challenge, selectedDrillOption: 'string_3m', selectedUtilityLink: 'hv_umbilical_cable' }));
    expect(onCable.gates.CDR?.passed).toBe(true);
    expect(onCable.result.iceKg).toBeGreaterThanOrEqual(ip.water_target_kg);
    expect(onCable.score.total).toBeGreaterThan(fly(design(challenge)).score.total);
  });

  it('heater power above the minimum sublimates ice at the latent-heat rate, and costs shadow margin', () => {
    const extraW = 100;
    const cold = design({ ...challenge, selectedBattery: 'rfc_25kwh' });
    const warm = design({ ...challenge, selectedBattery: 'rfc_25kwh', drillHeaterW: c.simulation.min_drill_heater_w + extraW });
    const expectedKgH = ((extraW * 3600) / (c.system_constants.ice_sublimation_energy_mj_kg * 1e6)) * ip.heater_extraction_efficiency;
    expect(iceRateKgPerHour(c, warm) - iceRateKgPerHour(c, cold)).toBeCloseTo(expectedKgH, 9);
    expect(eclipseEnergy(c, warm).margin).toBeLessThan(eclipseEnergy(c, cold).margin);
    expect(fly(warm).result.iceKg).toBeGreaterThan(fly(cold).result.iceKg);
  });

  it('the same heater on the reference battery fails the PDR power margin: water is paid for in battery', () => {
    const r = fly(design({ ...challenge, drillHeaterW: c.simulation.min_drill_heater_w + 100 }));
    expect(r.gates.PDR?.reasonCode).toBe('ERR_PDR_POWER_MARGIN_VIOLATION');
  });

  it('an unknown drill string falls back to the default one', () => {
    expect(design({ selectedDrillOption: 'no_such_string' }).drillOption.id).toBe(ip.default_drill_option);
  });

  it('constants validation rejects a default drill string that does not exist', () => {
    const broken = { ...raw, ice_prospecting: { ...raw.ice_prospecting, default_drill_option: 'missing' } };
    expect(validateConstants(broken)).toContain('ice_prospecting.default_drill_option must name one of its drill_options');
  });

  it('keeps a separate personal best for the challenge', () => {
    const data = new Map<string, string>();
    const store: KeyValueStore = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    const run = { score: 700, iceKg: 5000, dataCompleteness: 1, uptimeHours: 8760, minSoCPercent: 40, costUSD: 240e6, lostDay: null };
    const blob = (d: typeof REFERENCE_DESIGN) => ({ format: 'space-mission-simulator/design' as const, version: 1 as const, createdAt: '', difficulty: 'engineer' as const, seed, design: d });
    recordRun('engineer', run, blob({ ...REFERENCE_DESIGN, ...challenge }), store);
    expect(loadBest('engineer', store)).toBeNull();
    expect(loadBest('engineer', store, true)?.score).toBe(700);
  });
});
