import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConstants } from '../src/engine/ConstantsLoader';
import {
  buildProvenanceGroups, collectNumbers, danglingProvenanceKeys, formatValue, tierCounts, uncoveredNumbers, unitFor,
} from '../src/ui/aboutModel';

const c = parseConstants(JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8')));

describe('About & Numbers — every number has a source (design guide §4 rule 1)', () => {
  it('no number in engine-constants.json lacks provenance', () => expect(uncoveredNumbers(c)).toEqual([]));
  it('no provenance key points at nothing', () => expect(danglingProvenanceKeys(c)).toEqual([]));
  it('every number lands in exactly one group, and tier counts add up', () => {
    const grouped = buildProvenanceGroups(c).reduce((n, g) => n + g.rows.length, 0);
    const total = collectNumbers(c).length;
    expect(grouped).toBe(total);
    expect(Object.values(tierCounts(c)).reduce((a, b) => a + b, 0)).toBe(total);
  });
  it('NASA-document numbers include the verified GSFC margins', () => {
    const nasa = buildProvenanceGroups(c).filter((g) => g.provenance.tier === 'nasa-doc').flatMap((g) => g.rows.map((r) => r.path));
    expect(nasa).toContain('system_constants.minimum_power_margin_pdr');
    expect(nasa).toContain('system_constants.minimum_mass_margin_pdr');
  });
});

describe('About & Numbers — units in every label (rule 7)', () => {
  it('reads units from key suffixes', () => {
    expect(unitFor(c, 'system_constants.lunar_gravity_m_s2')).toBe('m/s²');
    expect(unitFor(c, 'trajectories.direct.descent_delta_v_m_s')).toBe('m/s');
    expect(unitFor(c, 'hardware_catalog.power_masts.mast_10m_vsat.rated_power_w')).toBe('W');
    expect(unitFor(c, 'site_catalog.shackleton_ridge.ambient_cold_trap_temperature_k')).toBe('K');
    expect(unitFor(c, 'side_quests.quest_optical_beaming.correct_value')).toBe('W');
  });
  it('formats money and small constants readably', () => {
    expect(formatValue(c, 'hardware_catalog.power_masts.mast_10m_vsat.cost_usd', 24_000_000)).toBe('$24M');
    // per-kilometre catalog items say so, so the figure is not read as a total (Hardware review)
    expect(formatValue(c, 'hardware_catalog.cold_trap_logistics.hts_maglev_guideway.mass_kg', 110)).toBe('110 kg per km');
    expect(formatValue(c, 'hardware_catalog.cold_trap_logistics.hts_maglev_guideway.cost_usd', 4_800_000)).toBe('$4.8M per km');
    expect(formatValue(c, 'hardware_catalog.utility_links.hv_umbilical_cable.mass_kg', 72)).toBe('72 kg per km');
    expect(formatValue(c, 'hardware_catalog.cold_trap_logistics.viper_heritage_rover.mass_kg', 430)).toBe('430 kg');
    expect(formatValue(c, 'system_constants.stefan_boltzmann_w_m2_k4', 5.670374419e-8)).toMatch(/^5\.6704e-8 W\/\(m²·K⁴\)$/);
    expect(formatValue(c, 'site_catalog.shackleton_ridge.slope_deg', 7.2)).toBe('7.2°');
    expect(formatValue(c, 'system_constants.minimum_power_margin_pdr', 0.15)).toBe('15%');
    expect(formatValue(c, 'hardware_catalog.cold_trap_logistics.hts_maglev_guideway.reliability_365d', 0.998)).toBe('99.8%');
  });
});
