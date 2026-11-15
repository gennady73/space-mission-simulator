import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConstants, validateConstants } from '../src/engine/ConstantsLoader';
import { runMission, scoreMission } from '../src/engine/SimulationClock';
import { runDesignGates } from '../src/engine/StageGateValidators';
import {
  computeLedger, dryMassKg, eclipseEnergy, hasLink, isResolved, payloadMassKg, resolveDesign, survivalLoadW, totalCostUSD, type ResolvedDesign,
} from '../src/engine/SubsystemEngines';
import type { MissionChallengeId } from '../src/models/Interfaces';
import { REFERENCE_DESIGN } from '../src/models/StateStore';
import { challengeKey } from '../src/ui/bestRuns';

/** D-041: night survival, far-side radio telescope, Artemis crew support, commercial lander ride. */
const raw = JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8'));
const c = parseConstants(raw);
const mc = c.mission_challenges;
const budget = c.difficulty_levels.engineer.budget_usd;
const seed = c.simulation.default_seed;

type Patch = Partial<typeof REFERENCE_DESIGN>;
const design = (challenges: MissionChallengeId[], patch: Patch = {}): ResolvedDesign => {
  const r = resolveDesign(c, { ...REFERENCE_DESIGN, missionChallenges: challenges, ...patch });
  if (!isResolved(r)) throw new Error(r.missing.join(', '));
  return r;
};
const fly = (r: ResolvedDesign, randomEvents = false, s = seed) => {
  const gates = runDesignGates(c, r);
  const passed = Object.values(gates).filter((g) => g?.passed).length;
  const result = runMission(c, r, { seed: s, randomEvents });
  return { gates, result, score: scoreMission(c, r, result, passed, budget), firstFail: Object.values(gates).find((g) => !g?.passed)?.reasonCode ?? null };
};
const plain = design([]);
const sintered: Patch = { selectedLaunchpad: 'pad_sintered', padDistanceM: 1500 };

describe('mission challenges off (D-041)', () => {
  it('the plain design resolves with no challenge and the empty night power source', () => {
    expect(plain.challenges).toEqual({ night: null, farSide: null, crew: null, clps: null });
    expect(plain.nightPower.id).toBe(mc.night_survival.default_night_power);
    expect(plain.nightPower.mass_kg + plain.nightPower.cost_usd + plain.nightPower.power_w).toBe(0);
  });
  it('a night power choice is ignored while the night challenge is off', () => {
    const r = design([], { selectedNightPower: 'fsp_1kw' });
    expect(dryMassKg(r)).toBe(dryMassKg(plain));
    expect(totalCostUSD(r)).toBe(totalCostUSD(plain));
  });
  it('the reference mission flies as before', () => {
    const f = fly(plain, true);
    expect(f.firstFail).toBeNull();
    expect(f.result.delayHours).toBe(0);
    expect(f.result.uptimeHours).toBe(c.simulation.mission_duration_h);
  });
});

describe('lunar night survival', () => {
  const night = mc.night_survival;
  it('the reference design fails the PDR power margin and browns out', () => {
    const f = fly(design(['night_survival']));
    expect(eclipseEnergy(c, design(['night_survival'])).shadowH).toBe(night.night_h);
    expect(f.firstFail).toBe('ERR_PDR_POWER_MARGIN_VIOLATION');
    expect(f.result.failureCause).toBe('BROWNOUT');
  });
  it('no battery in the catalog survives the night alone', () => {
    for (const id of Object.keys(c.hardware_catalog.energy_storage)) {
      expect(fly(design(['night_survival'], { selectedBattery: id })).firstFail).toBe('ERR_PDR_POWER_MARGIN_VIOLATION');
    }
  });
  it('a radioisotope generator carries the survival load: the year is survived, with fewer drilling hours', () => {
    const f = fly(design(['night_survival'], { selectedNightPower: 'rtg_110w' }));
    expect(f.firstFail).toBeNull();
    expect(f.result.failureCause).toBeNull();
    expect(f.result.iceKg).toBeLessThan(fly(plain).result.iceKg);
    expect(f.result.eclipseHours).toBeGreaterThanOrEqual(12 * night.night_h);
  });
  it('the generator is too small once the rover heater is added', () => {
    expect(fly(design(['night_survival'], { selectedNightPower: 'rtg_110w', selectedLogistics: 'viper_heritage_rover' })).firstFail).toBe('ERR_PDR_POWER_MARGIN_VIOLATION');
  });
  it('the fission reactor keeps the drill working at night, for more mass and money', () => {
    const rtg = design(['night_survival'], { selectedNightPower: 'rtg_110w' });
    const fsp = design(['night_survival'], { selectedNightPower: 'fsp_1kw' });
    expect(fly(fsp).result.iceKg).toBeGreaterThan(fly(rtg).result.iceKg);
    expect(dryMassKg(fsp)).toBeGreaterThan(dryMassKg(rtg));
    expect(totalCostUSD(fsp)).toBeGreaterThan(totalCostUSD(rtg));
    expect(fly(fsp).result.failureCause).toBeNull();
  });
  it('constants validation rejects a default night power source that does not exist', () => {
    const broken = { ...raw, mission_challenges: { ...raw.mission_challenges, night_survival: { ...raw.mission_challenges.night_survival, default_night_power: 'missing' } } };
    expect(validateConstants(broken)).toContain('mission_challenges.night_survival.default_night_power must name one of its night_power_options');
  });
});

describe('far-side radio telescope', () => {
  it('adds the telescope to the instruments, with its mass and cost', () => {
    const r = design(['far_side_telescope']);
    const t = mc.far_side_telescope.telescope;
    expect(r.instruments.map((i) => i.id)).toContain(t.id);
    expect(dryMassKg(r) - dryMassKg(plain)).toBeCloseTo(t.mass_kg, 6);
    expect(totalCostUSD(r) - totalCostUSD(plain)).toBeCloseTo(t.cost_usd, 6);
  });
  it('a direct-to-Earth radio never has a link and fails PDR; no data comes home', () => {
    const r = design(['far_side_telescope']);
    expect([0, 100, 5000].some((h) => hasLink(c, r, h))).toBe(false);
    const f = fly(r);
    expect(f.firstFail).toBe('ERR_PDR_NO_EARTH_LINK');
    expect(f.result.linkHours).toBe(0);
    expect(f.score.dataCompleteness).toBeLessThan(0.1);
  });
  it('the relay service passes every review and brings the data home', () => {
    const f = fly(design(['far_side_telescope'], { selectedComm: 'lunar_relay_service' }));
    expect(f.firstFail).toBeNull();
    expect(f.score.dataCompleteness).toBeGreaterThan(0.95);
  });
  it('a site that fails MCR only on Earth visibility is allowed on the far side', () => {
    const blind = Object.values(c.site_catalog).find((s) => s.slope_deg <= c.simulation.max_touchdown_slope_deg && s.earth_visibility_fraction < c.simulation.min_earth_visibility_fraction);
    expect(blind).toBeDefined();
    expect(runDesignGates(c, design([], { selectedSite: blind!.id })).MCR?.reasonCode).toBe('ERR_MCR_RADIO_BLACKOUT');
    expect(runDesignGates(c, design(['far_side_telescope'], { selectedSite: blind!.id })).MCR?.passed).toBe(true);
  });
});

describe('Artemis crew support', () => {
  const crew = mc.crew_support;
  it('adds the cargo and the beacon load', () => {
    const r = design(['crew_support']);
    expect(dryMassKg(r) - dryMassKg(plain)).toBeCloseTo(crew.cargo_mass_kg, 6);
    expect(totalCostUSD(r) - totalCostUSD(plain)).toBeCloseTo(crew.cargo_cost_usd, 6);
    expect(survivalLoadW(c, r) - survivalLoadW(c, plain)).toBeCloseTo(crew.beacon_power_w, 6);
  });
  it('the beacon eats the reference battery margin; a bigger pack passes', () => {
    expect(fly(design(['crew_support'])).firstFail).toBe('ERR_PDR_POWER_MARGIN_VIOLATION');
    expect(fly(design(['crew_support'], { selectedBattery: 'batt_liion_12kwh' })).firstFail).toBeNull();
  });
  it('the sintered pad meets the date on the direct transfer and misses it on the slow one', () => {
    const big = { selectedBattery: 'batt_liion_12kwh' };
    expect(fly(design(['crew_support'], { ...sintered, ...big })).firstFail).toBeNull();
    const slow = fly(design(['crew_support'], { ...sintered, ...big, selectedTrajectory: 'ballistic_lunar_transfer' }));
    expect(slow.firstFail).toBe('ERR_SRR_CREW_DATE_MISSED');
    expect(fly(design(['crew_support'], { ...big, selectedTrajectory: 'ballistic_lunar_transfer' })).firstFail).toBeNull();
  });
  it('a crew lander needs a prepared pad', () => {
    expect(fly(design(['crew_support'], { selectedLaunchpad: 'pad_natural_bowl', padDistanceM: 1800 })).firstFail).toBe('ERR_SRR_CREW_PAD');
  });
});

describe('commercial lander ride', () => {
  const clps = mc.clps_ride;
  it('one delivery price replaces the launcher, the lander bus and the trajectory surcharge', () => {
    const r = design(['clps_ride']);
    expect(totalCostUSD(plain) - totalCostUSD(r)).toBeCloseTo(plain.bus.cost_usd + plain.launchVehicle.cost_usd + plain.trajectory.extra_cost_usd - clps.delivery_cost_usd, 6);
    expect(totalCostUSD(r)).toBeLessThan(totalCostUSD(plain));
  });
  it('the mass tile shows payload against the lander capacity', () => {
    const r = design(['clps_ride']);
    const l = computeLedger(c, r, budget);
    expect(l.wetMassKg).toBeCloseTo(payloadMassKg(r), 6);
    expect(l.launchCapacityKg).toBe(clps.payload_capacity_kg);
  });
  it('the reference payload is too heavy; a lighter pad fits and scores well', () => {
    expect(fly(design(['clps_ride'])).firstFail).toBe('ERR_SRR_CLPS_PAYLOAD_MASS');
    const lean = fly(design(['clps_ride'], sintered));
    expect(lean.firstFail).toBeNull();
    expect(lean.score.total).toBeGreaterThan(fly(design(['clps_ride'])).score.total);
  });
  it('the lander passes only limited survival power to its payload', () => {
    const r = design(['clps_ride'], { ...sintered, selectedMast: 'mast_3m_fixed', drillHeaterW: clps.max_survival_power_w });
    expect(payloadMassKg(r)).toBeLessThanOrEqual(clps.payload_capacity_kg);
    expect(runDesignGates(c, r).SRR?.reasonCode).toBe('ERR_SRR_CLPS_POWER');
  });
  it('the lander is late in some years, about as often as its delay chance, and a late start costs ice', () => {
    const r = design(['clps_ride'], sintered);
    const runs = Array.from({ length: 200 }, (_, i) => fly(r, true, i + 1).result);
    const late = runs.filter((x) => x.delayHours > 0);
    expect(late.length / runs.length).toBeGreaterThan(clps.delay_probability / 2);
    expect(late.length / runs.length).toBeLessThan(clps.delay_probability * 2);
    expect(late[0].delayHours).toBe(clps.delay_days * 24);
    expect(late[0].iceKg).toBeLessThan(fly(r).result.iceKg);
    expect(fly(r).result.delayHours).toBe(0); // no random events, no delay
  });
});

describe('personal best per challenge combination', () => {
  it('builds a stable key from the challenges that are on', () => {
    expect(challengeKey(REFERENCE_DESIGN)).toBe('');
    expect(challengeKey({ ...REFERENCE_DESIGN, iceProspecting: true })).toBe('-ice');
    expect(challengeKey({ ...REFERENCE_DESIGN, missionChallenges: ['night_survival', 'clps_ride'] })).toBe('-clps_ride-night_survival');
    expect(challengeKey({ ...REFERENCE_DESIGN, iceProspecting: true, missionChallenges: ['crew_support'] })).toBe('-ice-crew_support');
  });
});
