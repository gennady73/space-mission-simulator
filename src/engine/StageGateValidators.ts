import type { EngineConstants, GateValidationResult, LandingSite, Phase } from '../models/Interfaces';
import {
  drillPeakW, eclipseEnergy, massStack, payloadMassKg, survivalLoadW, totalCostUSD, utilityLinkPower,
  type ResolvedDesign,
} from './SubsystemEngines';

/**
 * Deterministic stage gates (spec v2 §5), adapted:
 *  - thresholds read from engine-constants.json (REQ-003), never hard-coded;
 *  - PDR uses the design's own survival load and the site's longest shadow (D-005);
 *  - SRR also checks wet mass and fairing against the launcher (challenge: "check mass vs launch vehicle");
 *  - CDR also checks route slope and link range against the site (D-012).
 * Each check returns the FIRST failure, so the player fixes one cause at a time.
 */

const pass = (gateName: string, governingStandard: string, diagnosticExplanation: string): GateValidationResult =>
  ({ passed: true, gateName, governingStandard, reasonCode: 'PASS', diagnosticExplanation, remediationAction: '' });

const fail = (gateName: string, governingStandard: string, reasonCode: string, diagnosticExplanation: string, remediationAction: string): GateValidationResult =>
  ({ passed: false, gateName, governingStandard, reasonCode, diagnosticExplanation, remediationAction });

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export const GATE_NAMES: Record<Phase, string> = {
  MCR: 'Mission Concept Review (MCR)',
  SRR: 'System Requirements Review (SRR)',
  PDR: 'Preliminary Design Review (PDR)',
  CDR: 'Critical Design Review (CDR)',
  PLAR: 'Post-Launch Assessment Review (PLAR)',
};

/** D-041: `farSide` skips the Earth-visibility check, because the far-side challenge forbids a direct link anyway (checked at PDR). */
export function validateMCR(c: EngineConstants, site: LandingSite, farSide = false): GateValidationResult {
  const g = GATE_NAMES.MCR;
  const maxSlope = c.simulation.max_touchdown_slope_deg;
  const minVis = c.simulation.min_earth_visibility_fraction;
  if (site.slope_deg > maxSlope) {
    return fail(g, 'NPR 7123.1 ConOps Baseline', 'ERR_MCR_SLOPE_EXCEEDED',
      `Site slope of ${site.slope_deg}° exceeds the maximum stable lander touchdown limit of ${maxSlope}°.`,
      `Choose a plateau or ridge crest with slope ≤ ${maxSlope}°. A Navigation Doppler Lidar shows slopes before you commit.`);
  }
  if (!farSide && site.earth_visibility_fraction < minVis) {
    return fail(g, 'Mission ConOps — communications', 'ERR_MCR_RADIO_BLACKOUT',
      `Direct-to-Earth visibility (${pct(site.earth_visibility_fraction)}) fails the minimum ${pct(minVis)} threshold.`,
      'Select an elevated rim location with a clearer line of sight to Earth.');
  }
  return pass(g, 'NPR 7123.1', `${site.name}: slope ${site.slope_deg}°, Earth visible ${pct(site.earth_visibility_fraction)} of the time.`);
}

export function validateSRR(c: EngineConstants, r: ResolvedDesign): GateValidationResult {
  const g = GATE_NAMES.SRR;
  const pad = r.launchpad;
  if (r.padDistanceM < pad.requires_standoff_distance_m) {
    return fail(g, 'STMD SF03 / Need 3.01 (Plume-Surface Interaction)', 'ERR_SRR_PLUME_SCOURING_HAZARD',
      `Separation distance (${r.padDistanceM} m) is below the required ${pad.requires_standoff_distance_m} m buffer for ${pad.name}. Rocket exhaust ejecta (> 300 m/s) would sandblast the solar arrays.`,
      'Increase the standoff distance, or choose an elevated pad with 45° plume deflectors.');
  }
  const { clps, crew } = r.challenges;
  if (crew) {
    if (pad.deflection_efficiency < crew.min_pad_deflection_efficiency) {
      return fail(g, 'Artemis crew landing: prepared surface (game rule)', 'ERR_SRR_CREW_PAD',
        `${pad.name} deflects only ${Math.round(pad.deflection_efficiency * 100)}% of the plume. A crew lander needs a prepared pad with at least ${Math.round(crew.min_pad_deflection_efficiency * 100)}%.`,
        'Choose the sintered pad or the elevated pad.');
    }
    const readyDay = r.trajectory.cruise_days + pad.construction_days;
    if (readyDay > crew.crew_arrival_days) {
      return fail(g, 'Artemis crew landing: schedule (game rule)', 'ERR_SRR_CREW_DATE_MISSED',
        `The pad and beacon are ready on day ${readyDay} (${r.trajectory.cruise_days} days of cruise + ${pad.construction_days} days to build ${pad.name}), but the crew lands on day ${crew.crew_arrival_days}.`,
        'Take the faster transfer, or a pad that needs no construction time.');
    }
  }
  if (clps) {
    const payload = payloadMassKg(r);
    if (payload > clps.payload_capacity_kg) {
      return fail(g, 'Commercial lander payload limit (game rule)', 'ERR_SRR_CLPS_PAYLOAD_MASS',
        `Payload ${Math.round(payload)} kg exceeds the commercial lander's ${clps.payload_capacity_kg} kg.`,
        'Remove mass: a lighter pad, mast, battery or cold-trap logistics.');
    }
    const load = survivalLoadW(c, r);
    if (load > clps.max_survival_power_w) {
      return fail(g, 'Commercial lander power service (game rule)', 'ERR_SRR_CLPS_POWER',
        `Survival load ${load.toFixed(0)} W exceeds the ${clps.max_survival_power_w} W the commercial lander can pass to its payload.`,
        'Lower the heater power, or drop equipment that needs survival heating.');
    }
    return pass(g, 'STMD SF03 / Need 3.01', `Plume buffer verified; payload ${Math.round(payload)} kg fits the commercial lander.`);
  }
  const m = massStack(c, r);
  if (m.wet > r.launchVehicle.tli_capacity_kg) {
    return fail(g, 'Launch vehicle payload envelope (spec §3.1)', 'ERR_SRR_MASS_EXCEEDS_LV',
      `Wet mass ${Math.round(m.wet)} kg (dry ${Math.round(m.dry)} + ${Math.round(c.system_constants.minimum_mass_margin_pdr * 100)}% contingency ${Math.round(m.contingency)} + propellant ${Math.round(m.propellant)}) exceeds ${r.launchVehicle.name} capacity of ${r.launchVehicle.tli_capacity_kg} kg.`,
      'Choose a larger launcher, or remove mass: every dry kilogram costs ~0.8 kg of landing propellant.');
  }
  if (r.bus.diameter_m > r.launchVehicle.fairing_diameter_m) {
    return fail(g, 'Launch vehicle payload envelope (spec §3.1)', 'ERR_SRR_FAIRING_ENVELOPE',
      `Lander diameter ${r.bus.diameter_m} m does not fit the ${r.launchVehicle.fairing_diameter_m} m fairing.`,
      'Choose a launcher with a wider fairing.');
  }
  return pass(g, 'STMD SF03 / Need 3.01', `Plume buffer verified; wet mass ${Math.round(m.wet)} kg fits ${r.launchVehicle.name}.`);
}

export function validatePDR(c: EngineConstants, r: ResolvedDesign): GateValidationResult {
  const g = GATE_NAMES.PDR;
  const minMargin = c.system_constants.minimum_power_margin_pdr;
  if (r.challenges.farSide && r.comm.direct_to_earth) {
    return fail(g, 'Mission ConOps: communications', 'ERR_PDR_NO_EARTH_LINK',
      `${r.comm.name} needs Earth above the horizon, and on the far side Earth never rises.`,
      'Use the relay orbiter service.');
  }
  const e = eclipseEnergy(c, r);
  if (e.margin < minMargin) {
    const load = survivalLoadW(c, r);
    return fail(g, 'GSFC-STD-1000 Rule 1.06 (Resource Margins)', 'ERR_PDR_POWER_MARGIN_VIOLATION',
      `Power margin ${pct(e.margin)} is below the mandatory ${pct(minMargin)} PDR threshold. Survival load ${load.toFixed(0)} W × ${Number.isFinite(e.shadowH) ? e.shadowH.toFixed(0) : '∞'} h shadow for the ${r.mast.name} = ${Math.round(e.required)} Wh needed; battery gives ${Math.round(e.available)} Wh usable. Risk of brownout.`,
      Number.isFinite(e.required)
        ? `Increase battery capacity to at least ${Math.ceil((e.required * (1 + minMargin)) / r.battery.max_dod)} Wh nameplate, choose a taller mast (shorter shadows), or reduce survival loads.`
        : 'This mast never sees the Sun at this site. Choose a taller mast or a sunlit site.');
  }
  return pass(g, 'GSFC-STD-1000 Rule 1.06', `Eclipse power margin ${pct(e.margin)} ≥ ${pct(minMargin)}.`);
}

export function validateCDR(c: EngineConstants, r: ResolvedDesign): GateValidationResult {
  const g = GATE_NAMES.CDR;
  const minHeater = c.simulation.min_drill_heater_w;
  if (r.drillHeaterW < minHeater) {
    return fail(g, 'STMD SF02 / Need 2.06 (Extreme Cold Operation)', 'ERR_CDR_THERMAL_FREEZE_HAZARD',
      `Drill heater power (${r.drillHeaterW} W) is below the ${minHeater} W threshold. Lubricants and seals bind at ${r.site.ambient_cold_trap_temperature_k} K.`,
      `Allocate at least ${minHeater} W survival heating to the drill assembly.`);
  }
  if (r.logistics && r.logistics.max_slope_deg < r.site.max_route_slope_deg) {
    return fail(g, 'STMD SF16 / Need 2.06 (Surface Mobility in Cold Traps)', 'ERR_CDR_ROUTE_TOO_STEEP',
      `${r.logistics.name} handles ${r.logistics.max_slope_deg}° but the route into the cold trap reaches ${r.site.max_route_slope_deg}°.`,
      'Use the HTS maglev guideway (28°) or pick a site with a gentler route.');
  }
  if (r.utilityLink?.max_range_km != null && r.utilityLink.max_range_km < r.site.distance_to_cold_trap_km) {
    return fail(g, 'STMD SF02 / Need 2.04 (Power Management & Distribution)', 'ERR_CDR_LINK_RANGE',
      `${r.utilityLink.name} reaches ${r.utilityLink.max_range_km} km but the cold trap is ${r.site.distance_to_cold_trap_km} km away.`,
      'Use the umbilical cable, or a site closer to the cold trap.');
  }
  const peak = drillPeakW(r);
  const delivered = utilityLinkPower(r, c.simulation.dust_event_beam_transmittance).deliveredW;
  if (peak > 0 && delivered < peak) {
    return fail(g, 'STMD SF02 / Need 2.04 (Power Management & Distribution)', 'ERR_CDR_LINK_POWER_DEFICIT',
      `Delivered link power (${delivered.toFixed(0)} W, worst case with dust) cannot support the peak drill load (${peak} W).`,
      'Upgrade the transmitter or switch to the high-voltage umbilical cable.');
  }
  return pass(g, 'STMD SF02 / Needs 2.04, 2.06', 'Cold-trap survival and power delivery verified.');
}

export function validatePLAR(uptimeHours: number, missionHours: number, totalCost: number, budgetUSD: number): GateValidationResult {
  const g = GATE_NAMES.PLAR;
  if (uptimeHours < missionHours) {
    return fail(g, 'Mission success criteria (NASA SP-2016-6105)', 'ERR_PLAR_EARLY_MISSION_TERMINATION',
      `Outpost failed at hour ${uptimeHours} (day ${Math.floor(uptimeHours / 24)}), short of the ${missionHours} h baseline.`,
      'Open the fault tree in the debrief to find the failed subsystem.');
  }
  if (totalCost > budgetUSD) {
    return fail(g, 'NPR 7120.5', 'ERR_PLAR_BUDGET_OVERRUN',
      `Total cost ($${(totalCost / 1e6).toFixed(1)}M) exceeded the budget cap ($${(budgetUSD / 1e6).toFixed(1)}M).`,
      'Trade expensive custom hardware for cheaper heritage options.');
  }
  return pass(g, 'NPR 7120.5', 'Mission successful.');
}

/** Pre-launch gates in order; stops at the first failed gate. */
export function runDesignGates(c: EngineConstants, r: ResolvedDesign): Partial<Record<Phase, GateValidationResult>> {
  const out: Partial<Record<Phase, GateValidationResult>> = {};
  out.MCR = validateMCR(c, r.site, r.challenges.farSide !== null); if (!out.MCR.passed) return out;
  out.SRR = validateSRR(c, r); if (!out.SRR.passed) return out;
  out.PDR = validatePDR(c, r); if (!out.PDR.passed) return out;
  out.CDR = validateCDR(c, r);
  return out;
}

export { totalCostUSD };
