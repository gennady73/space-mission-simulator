import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConstants } from '../src/engine/ConstantsLoader';
import { runDesignGates } from '../src/engine/StageGateValidators';
import { eclipseEnergy, isResolved, massStack, resolveDesign, shadowHoursForMast, type ResolvedDesign } from '../src/engine/SubsystemEngines';
import { runMission } from '../src/engine/SimulationClock';
import { REFERENCE_DESIGN } from '../src/models/StateStore';
import type { MissionDesignExport } from '../src/models/Interfaces';

const c = parseConstants(JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8')));
const design = (patch: Partial<MissionDesignExport['design']> = {}): ResolvedDesign => {
  const r = resolveDesign(c, { ...REFERENCE_DESIGN, ...patch });
  if (!isResolved(r)) throw new Error('unresolved: ' + r.missing.join(', '));
  return r;
};
const firstFailure = (r: ResolvedDesign) => Object.values(runDesignGates(c, r)).find((g) => g && !g.passed)?.reasonCode ?? 'PASS';

describe('engine-constants contract (REQ-003)', () => {
  it('loads and validates', () => expect(c.schema_version).toBe('1.0.0'));
  it('GSFC PDR margin is 20%', () => expect(c.system_constants.minimum_gsfc_margin_pdr).toBe(0.2));
  it('every side quest answer matches its own formula inputs', () => {
    expect(c.side_quests.quest_battery_sizing.correct_value).toBeCloseTo((85 * 54) / 0.8, 1);
    expect(c.side_quests.quest_pdr_margin.correct_value).toBeCloseTo((85 * 54 * 1.2) / 0.8, 1);
    expect(c.side_quests.quest_data_buffer.correct_value).toBeCloseTo((120_000 * 14 * 3600) / 1e6, 1);
    expect(c.side_quests.quest_optical_beaming.correct_value).toBeCloseTo(1000 * 0.22 * 0.9, 1);
    expect(c.side_quests.quest_plume_deflector.correct_value).toBe(c.hardware_catalog.launchpads.pad_elevated_45deg.requires_standoff_distance_m);
  });
});

describe('GSFC-STD-1000 margins (REQ-005)', () => {
  it('10 m mast at Shackleton sees the 54 h reference shadow', () => {
    expect(shadowHoursForMast(c, c.site_catalog.shackleton_ridge, c.hardware_catalog.power_masts.mast_10m_vsat)).toBeCloseTo(54, 0);
  });
  it('reference design keeps >= 20% eclipse margin', () => expect(eclipseEnergy(c, design()).margin).toBeGreaterThanOrEqual(0.2));
  it('6 kWh "looks enough" but fails PDR', () => expect(firstFailure(design({ selectedBattery: 'batt_liion_6kwh' }))).toBe('ERR_PDR_POWER_MARGIN_VIOLATION'));
  it('4 kWh fails PDR', () => expect(firstFailure(design({ selectedBattery: 'batt_liion_4kwh' }))).toBe('ERR_PDR_POWER_MARGIN_VIOLATION'));
  it('3 m mast fails PDR (long shadows), not later', () => expect(firstFailure(design({ selectedMast: 'mast_3m_fixed' }))).toBe('ERR_PDR_POWER_MARGIN_VIOLATION'));
  it('wet mass includes 20% contingency and Tsiolkovsky propellant', () => {
    const m = massStack(c, design());
    expect(m.contingency).toBeCloseTo(m.dry * 0.2, 6);
    expect(m.propellant / (m.dry + m.contingency)).toBeCloseTo(Math.exp(1850 / (320 * 9.80665)) - 1, 6);
  });
});

describe('stage gates', () => {
  it('reference design passes MCR→CDR', () => expect(firstFailure(design())).toBe('PASS'));
  it('Haworth floor fails MCR on radio', () => expect(firstFailure(design({ selectedSite: 'haworth_floor' }))).toBe('ERR_MCR_RADIO_BLACKOUT'));
  it('Faustini rim fails MCR on slope', () => expect(firstFailure(design({ selectedSite: 'faustini_rim' }))).toBe('ERR_MCR_SLOPE_EXCEEDED'));
  it('bowl pad at 800 m fails SRR plume', () => expect(firstFailure(design({ selectedLaunchpad: 'pad_natural_bowl' }))).toBe('ERR_SRR_PLUME_SCOURING_HAZARD'));
  it('rideshare slot fails SRR mass', () => expect(firstFailure(design({ selectedLaunchVehicle: 'lv_rideshare_lander' }))).toBe('ERR_SRR_MASS_EXCEEDS_LV'));
  it('rover at Shackleton fails on route slope (or power first)', () =>
    expect(['ERR_CDR_ROUTE_TOO_STEEP', 'ERR_PDR_POWER_MARGIN_VIOLATION']).toContain(firstFailure(design({ selectedLogistics: 'viper_heritage_rover' }))));
  it('20 W drill heater fails CDR', () => expect(firstFailure(design({ drillHeaterW: 20 }))).toBe('ERR_CDR_THERMAL_FREEZE_HAZARD'));
});

describe('365-day simulation (REQ-001)', () => {
  it('reference mission survives 8,760 h and is deterministic', () => {
    const a = runMission(c, design(), { seed: 42, randomEvents: true, logEveryHours: 24 });
    const b = runMission(c, design(), { seed: 42, randomEvents: true, logEveryHours: 24 });
    expect(a.uptimeHours).toBe(8760);
    expect(a.failureCause).toBeNull();
    expect(a.iceKg).toBe(b.iceKg);
    expect(a.events).toEqual(b.events);
  });
  it('undersized battery browns out', () => {
    expect(runMission(c, design({ selectedBattery: 'batt_liion_4kwh' }), { seed: 1, randomEvents: false }).failureCause).toBe('BROWNOUT');
  });
});
