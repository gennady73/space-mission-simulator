import type {
  BatteryConfig, CommConfig, DataStorageConfig, EngineConstants, InstrumentConfig, LandingSite,
  LaunchVehicle, LaunchpadConfig, LogisticsConfig, PowerMastConfig, ResourceLedger,
  SimulationState, SpacecraftBusConfig, TrajectoryOption, UtilityLinkConfig,
} from '../models/Interfaces';

/** A design with every selected id resolved to its catalog entry. */
export interface ResolvedDesign {
  site: LandingSite;
  trajectory: TrajectoryOption;
  bus: SpacecraftBusConfig;
  launchVehicle: LaunchVehicle;
  launchpad: LaunchpadConfig;
  padDistanceM: number;
  mast: PowerMastConfig;
  battery: BatteryConfig;
  comm: CommConfig;
  storage: DataStorageConfig;
  logistics: LogisticsConfig | null; // null when the site has no cold-trap distance
  utilityLink: UtilityLinkConfig | null;
  instruments: InstrumentConfig[];
  drillHeaterW: number;
}

type Design = Pick<SimulationState,
  'selectedSite' | 'selectedTrajectory' | 'selectedBus' | 'selectedLaunchVehicle' | 'selectedLaunchpad'
  | 'padDistanceM' | 'selectedMast' | 'selectedBattery' | 'selectedComm' | 'selectedStorage'
  | 'selectedLogistics' | 'selectedUtilityLink' | 'selectedInstruments' | 'drillHeaterW'>;

/** Returns the resolved design, or the list of choices still missing. */
export function resolveDesign(c: EngineConstants, d: Design): ResolvedDesign | { missing: string[] } {
  const hw = c.hardware_catalog;
  const missing: string[] = [];
  const pick = <T>(table: Record<string, T>, id: string | null, label: string): T | undefined => {
    const v = id ? table[id] : undefined;
    if (!v) missing.push(label);
    return v;
  };
  const site = pick(c.site_catalog, d.selectedSite, 'landing site');
  const trajectory = pick(c.trajectories, d.selectedTrajectory, 'trajectory');
  const bus = pick(hw.spacecraft_bus, d.selectedBus, 'spacecraft bus');
  const launchVehicle = pick(hw.launch_vehicles, d.selectedLaunchVehicle, 'launch vehicle');
  const launchpad = pick(hw.launchpads, d.selectedLaunchpad, 'landing pad');
  const mast = pick(hw.power_masts, d.selectedMast, 'power mast');
  const battery = pick(hw.energy_storage, d.selectedBattery, 'battery');
  const comm = pick(hw.comm_systems, d.selectedComm, 'communications');
  const storage = pick(hw.data_storage, d.selectedStorage, 'data storage');
  if (d.padDistanceM === null) missing.push('pad standoff distance');
  const needsColdTrapAccess = site ? site.distance_to_cold_trap_km > 0 : true;
  const logistics = needsColdTrapAccess ? pick(hw.cold_trap_logistics, d.selectedLogistics, 'cold-trap logistics') ?? null : null;
  const utilityLink = needsColdTrapAccess ? pick(hw.utility_links, d.selectedUtilityLink, 'utility power link') ?? null : null;
  const instruments = d.selectedInstruments.map((id) => hw.science_instruments[id]).filter(Boolean);
  if (missing.length) return { missing };
  return {
    site: site!, trajectory: trajectory!, bus: bus!, launchVehicle: launchVehicle!, launchpad: launchpad!,
    padDistanceM: d.padDistanceM!, mast: mast!, battery: battery!, comm: comm!, storage: storage!,
    logistics, utilityLink, instruments, drillHeaterW: d.drillHeaterW,
  };
}

export const isResolved = (r: ResolvedDesign | { missing: string[] }): r is ResolvedDesign => !('missing' in r);

const perKm = (cfg: { per_km: boolean }, value: number, km: number) => (cfg.per_km ? value * km : value);

// ---------------------------------------------------------------------------
// Launch segment (spec §3.1)
// ---------------------------------------------------------------------------

export function dryMassKg(r: ResolvedDesign): number {
  const km = r.site.distance_to_cold_trap_km;
  return r.bus.dry_mass_kg + r.launchpad.mass_kg + r.mast.mass_kg + r.battery.mass_kg + r.comm.mass_kg
    + r.storage.mass_kg
    + (r.logistics ? perKm(r.logistics, r.logistics.mass_kg, km) : 0)
    + (r.utilityLink ? perKm(r.utilityLink, r.utilityLink.mass_kg, km) : 0)
    + r.instruments.reduce((s, i) => s + i.mass_kg, 0);
}

/**
 * m_wet = m_dry + m_cont + m_prop. D-017: propellant is sized on (dry + contingency),
 * the conservative reading of spec §3.1 (the lander must also land the contingency).
 */
export function massStack(c: EngineConstants, r: ResolvedDesign) {
  const dry = dryMassKg(r);
  const contingency = dry * c.system_constants.minimum_gsfc_margin_pdr;
  const g0 = c.system_constants.standard_gravity_g0_m_s2;
  const ratio = Math.exp(r.trajectory.descent_delta_v_m_s / (r.bus.isp_s * g0));
  const propellant = (dry + contingency) * (ratio - 1);
  return { dry, contingency, propellant, wet: dry + contingency + propellant };
}

export function totalCostUSD(r: ResolvedDesign): number {
  const km = r.site.distance_to_cold_trap_km;
  return r.bus.cost_usd + r.launchVehicle.cost_usd + r.trajectory.extra_cost_usd + r.launchpad.cost_usd
    + r.mast.cost_usd + r.battery.cost_usd + r.comm.cost_usd + r.storage.cost_usd
    + (r.logistics ? perKm(r.logistics, r.logistics.cost_usd, km) : 0)
    + (r.utilityLink ? perKm(r.utilityLink, r.utilityLink.cost_usd, km) : 0)
    + r.instruments.reduce((s, i) => s + i.cost_usd, 0);
}

// ---------------------------------------------------------------------------
// Space segment (spec §3.2, corrected per D-002 / D-003 / D-005)
// ---------------------------------------------------------------------------

/** D-003: synthetic local solar elevation above the horizon mask (deg). */
export function solarElevationDeg(c: EngineConstants, site: LandingSite, hour: number): number {
  const T = c.system_constants.synodic_month_days * 24;
  return site.solar_elevation_mean_deg + c.simulation.solar_elevation_amplitude_deg * Math.sin((2 * Math.PI * hour) / T);
}

/**
 * D-002: vertical VSAT panels face a horizon-level Sun, so output is ~rated (cos α ≈ 1 for α < 4°)
 * whenever the Sun clears the mast's cutoff. Spec v2's sin(α) gave ≤ 3% of rated — a bug.
 */
export function solarPowerW(mast: PowerMastConfig, elevationDeg: number, dustTransmission: number): number {
  if (elevationDeg < mast.cutoff_elevation_deg) return 0;
  return mast.rated_power_w * Math.cos((elevationDeg * Math.PI) / 180) * dustTransmission;
}

/**
 * D-005: longest continuous shadow (h) for THIS mast at THIS site, from the D-003 model:
 * fraction of each synodic cycle below cutoff = acos((μ − cutoff) / A) / π.
 * site.max_shadow_h is the 10 m reference shown in the site card; gates use this function.
 */
export function shadowHoursForMast(c: EngineConstants, site: LandingSite, mast: PowerMastConfig): number {
  const A = c.simulation.solar_elevation_amplitude_deg;
  const x = (site.solar_elevation_mean_deg - mast.cutoff_elevation_deg) / A;
  if (x >= 1) return 0;          // never below cutoff
  if (x <= -1) return Infinity;  // never above cutoff (permanent shadow)
  return (c.system_constants.synodic_month_days * 24 * Math.acos(x)) / Math.PI;
}

/** D-005: survival ("shadow") load — what must run through every eclipse. */
export function survivalLoadW(c: EngineConstants, r: ResolvedDesign): number {
  return r.bus.avionics_power_w + r.drillHeaterW + c.simulation.comm_idle_power_w + r.storage.power_w
    + (r.logistics?.survival_heater_w ?? 0);
}

/** Usable battery energy vs. energy needed for the site's longest shadow. */
export function eclipseEnergy(c: EngineConstants, r: ResolvedDesign) {
  const shadowH = shadowHoursForMast(c, r.site, r.mast);
  const required = survivalLoadW(c, r) * shadowH;
  const available = r.battery.capacity_kwh * 1000 * r.battery.max_dod;
  const margin = !Number.isFinite(required) ? -Infinity : required > 0 ? (available - required) / required : Infinity;
  return { shadowH, required, available, margin };
}

/** Stefan–Boltzmann radiative loss (spec §3.2.3) — for the CDR side panel / quest. */
export function radiativeLossW(c: EngineConstants, emissivity: number, areaM2: number, tInstK: number, tAmbK: number): number {
  return emissivity * c.system_constants.stefan_boltzmann_w_m2_k4 * areaM2 * (tInstK ** 4 - tAmbK ** 4);
}

// ---------------------------------------------------------------------------
// Ground segment (spec §3.3, corrected per D-004)
// ---------------------------------------------------------------------------

/** D-004: Earth elevation above the local mask; spec v2 added site latitude (−89°), which is never > 0. */
export function earthElevationDeg(c: EngineConstants, site: LandingSite, hour: number): number {
  const s = c.simulation;
  return site.earth_elevation_mean_deg + s.earth_libration_amplitude_deg * Math.sin((2 * Math.PI * hour) / s.earth_libration_period_h);
}

export function hasLink(c: EngineConstants, r: ResolvedDesign, hour: number): boolean {
  if (!r.comm.direct_to_earth) return (hour % 24) < 24 * (r.comm.relay_coverage_fraction ?? 0);
  return earthElevationDeg(c, r.site, hour) >= c.simulation.min_earth_elevation_for_los_deg;
}

// ---------------------------------------------------------------------------
// Utility link (spec §3.2 / §6.4)
// ---------------------------------------------------------------------------

/** Power that reaches the drill, and what it costs at the mast. */
export function utilityLinkPower(r: ResolvedDesign, dustTransmittance = 1): { deliveredW: number; drawW: number } {
  if (!r.utilityLink) return { deliveredW: Infinity, drawW: 0 }; // drill sits at the lander
  const l = r.utilityLink;
  const t = l.attenuated_by_dust ? dustTransmittance : 1;
  return { deliveredW: l.source_power_w * l.efficiency * t, drawW: l.source_power_w };
}

export function drillPeakW(r: ResolvedDesign): number {
  return r.instruments.filter((i) => i.extracts_ice).reduce((s, i) => s + i.peak_power_w, 0);
}

// ---------------------------------------------------------------------------
// Resource ledger (the always-visible resource bar: mass, power, budget, data, comms, time)
// ---------------------------------------------------------------------------

export function computeLedger(c: EngineConstants, r: ResolvedDesign, budgetUSD: number): ResourceLedger {
  const m = massStack(c, r);
  const e = eclipseEnergy(c, r);
  const dataRateKbps = r.instruments.reduce((s, i) => s + i.data_rate_kbps, 0);
  let linkHours = 0;
  const T = Math.round(c.simulation.earth_libration_period_h);
  for (let h = 0; h < T; h++) if (hasLink(c, r, h)) linkHours++;
  return {
    dryMassKg: m.dry, contingencyMassKg: m.contingency, propellantMassKg: m.propellant, wetMassKg: m.wet,
    launchCapacityKg: r.launchVehicle.tli_capacity_kg,
    massMarginFraction: (r.launchVehicle.tli_capacity_kg - m.wet) / r.launchVehicle.tli_capacity_kg,
    totalCostUSD: totalCostUSD(r), budgetUSD,
    eclipseEnergyRequiredWh: e.required, eclipseEnergyAvailableWh: e.available, powerMarginFraction: e.margin,
    dataGeneratedMbPerDay: (dataRateKbps * 86400) / 1000,
    downlinkMbPerDay: ((r.comm.downlink_kbps * 86400) / 1000) * (linkHours / T),
    missionDurationDays: c.simulation.mission_duration_h / 24 + r.trajectory.cruise_days,
  };
}
