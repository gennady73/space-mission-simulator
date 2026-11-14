/**
 * Interface Control Document (ICD) — TypeScript contract.
 *
 * Source: docs/space-mission-simulator-implementation-specification-final-v2.md §2.2,
 * completed with every type the spec referenced but never defined, and adapted per
 * docs/BUILD-PLAN.md and docs/team/context/DECISIONS.md (D-001 … D-020).
 *
 * Ownership: Architect owns this file. Changes that touch EngineConstants must be
 * mirrored in public/config/engine-constants.json (owned by Lead) in the same PR.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type Phase = 'MCR' | 'SRR' | 'PDR' | 'CDR' | 'PLAR';
export type PlaceholderStage = 'INTRO' | Phase | 'DEBRIEF';
export type AspectRatio = '16:9' | '21:9' | '4:3';
export type Difficulty = 'cadet' | 'engineer' | 'flight_director';
/** Team-play seats (D-010). One seat per NASA mission segment. */
export type TeamRole = 'mission_lead' | 'launch_structures' | 'power_thermal' | 'comms_science';
/** Provenance tier (design guide §4 rule 9: separate rules from facts). */
export type SourceTier = 'nasa-doc' | 'literature' | 'physical-constant' | 'spec-provisional' | 'game-rule';

// ---------------------------------------------------------------------------
// Engine constants (loaded only from public/config/engine-constants.json — REQ-003)
// ---------------------------------------------------------------------------

export interface Provenance {
  source: string;
  tier: SourceTier;
  note?: string;
}

export interface EngineConstants {
  schema_version: string;
  system_constants: SystemConstants;
  simulation: SimulationSettings;
  difficulty_levels: Record<Difficulty, DifficultyConfig>;
  team_roles: Record<TeamRole, TeamRoleConfig>;
  site_catalog: Record<string, LandingSite>;
  trajectories: Record<string, TrajectoryOption>;
  /** Schematic map geometry (display only; never read by the engine). */
  map_features: MapFeatures;
  hardware_catalog: {
    spacecraft_bus: Record<string, SpacecraftBusConfig>;
    launch_vehicles: Record<string, LaunchVehicle>;
    launchpads: Record<string, LaunchpadConfig>;
    power_masts: Record<string, PowerMastConfig>;
    energy_storage: Record<string, BatteryConfig>;
    comm_systems: Record<string, CommConfig>;
    data_storage: Record<string, DataStorageConfig>;
    cold_trap_logistics: Record<string, LogisticsConfig>;
    utility_links: Record<string, UtilityLinkConfig>;
    science_instruments: Record<string, InstrumentConfig>;
  };
  graphic_placeholders: Record<string, GraphicPlaceholderConfig>;
  side_quests: Record<string, SideQuestConfig>;
  /** Feynman "questions first" (spec §8.1): asked before each phase; explanation shown after the player's hypothesis. */
  pre_stage_questions: Record<Phase, PreStageQuestion>;
  shortfall_badges: Record<string, ShortfallBadge>;
  /** JSON-pointer-like path (e.g. "system_constants.lunar_gravity_m_s2") -> provenance. */
  provenance: Record<string, Provenance>;
}

export interface SystemConstants {
  lunar_gravity_m_s2: number;
  standard_gravity_g0_m_s2: number;
  solar_flux_w_m2: number;
  synodic_month_days: number;
  tropical_month_days: number;
  lunar_axial_tilt_deg: number;
  /** Stefan–Boltzmann constant σ. Spec v2 called it "boltzmann_constant"; renamed (D-019). */
  stefan_boltzmann_w_m2_k4: number;
  ice_sublimation_energy_mj_kg: number;
  /** GSFC-STD-1000 Rule 1.06: power margin required at PDR (0.15). */
  minimum_power_margin_pdr: number;
  /** GSFC-STD-1000 Rule 1.06: dry-mass margin at PDR (0.10); used as mass contingency. */
  minimum_mass_margin_pdr: number;
  enable_graphic_placeholders: boolean;
}

export interface SimulationSettings {
  mission_duration_h: number;          // 8760
  time_step_h: number;                 // 1
  default_seed: number;                // D-009 deterministic PRNG seed
  solar_elevation_amplitude_deg: number;   // D-003 synthetic model
  earth_libration_amplitude_deg: number;   // ±6.7
  earth_libration_period_h: number;        // 655.7
  min_earth_elevation_for_los_deg: number; // 0.5
  dust_transmission_nominal: number;   // 0.95
  dust_transmission_scoured: number;   // 0.40
  pdr_reference_base_load_w: number;   // 85 (quest reference; gates use the design's own survival load, D-005)
  comm_idle_power_w: number;           // 10
  max_touchdown_slope_deg: number;     // 10 (MCR)
  min_earth_visibility_fraction: number; // 0.50 (MCR)
  drill_min_soc_percent: number;       // drill only runs above this battery state of charge
  min_drill_heater_w: number;          // 35
  ice_assay_rate_kg_h: number;         // 0.50
  ice_score_normaliser_kg: number;     // 1000
  dust_event_probability_per_cycle: number;
  dust_event_duration_h: number;
  dust_event_beam_transmittance: number; // 0.90
}

export interface DifficultyConfig {
  label: string;
  budget_usd: number;
  hints_enabled: boolean;
  random_events_enabled: boolean;
  sensor_gating_strict: boolean;
  description: string;
}

export interface TeamRoleConfig {
  label: string;
  segment: 'User' | 'Launch' | 'Space' | 'Ground';
  owns_gates: Phase[];
  decides: string[];
  priority_hint: string;
}

export interface LandingSite {
  id: string;
  name: string;
  lola_dataset_id: string | null;
  latitude_deg: number;
  longitude_deg: number;
  slope_deg: number;
  /** Fraction of the year the 10 m mast is lit (derived; shown in UI). */
  illumination_fraction: number;
  /** Longest single shadow at 10 m mast height, hours. Drives PDR (D-005). */
  max_shadow_h: number;
  /** D-003: mean local solar elevation above the topographic horizon, degrees. */
  solar_elevation_mean_deg: number;
  /** D-004: mean Earth elevation above the local topographic mask, degrees. */
  earth_elevation_mean_deg: number;
  /** Derived from earth_elevation_mean_deg; MCR checks this (≥ 0.50). */
  earth_visibility_fraction: number;
  distance_to_cold_trap_km: number;
  max_route_slope_deg: number;
  ambient_cold_trap_temperature_k: number;
  description: string;
}

export interface MapCrater {
  name: string;
  lat_deg: number;
  lon_deg: number;
  radius_km: number;
  depth_km: number;
  permanently_shadowed: boolean;
}

export interface MapMassif {
  name: string;
  lat_deg: number;
  lon_deg: number;
  radius_km: number;
  height_km: number;
}

export interface MapFeatures {
  moon_radius_km: number;
  /** Map bearing of the Sun at mission hour 0 (0 = up/0°E, 90 = right). */
  sun_azimuth_at_hour0_deg: number;
  craters: MapCrater[];
  massifs: MapMassif[];
}

export interface TrajectoryOption {
  id: string;
  name: string;
  cruise_days: number;
  descent_delta_v_m_s: number;
  extra_cost_usd: number;
  description: string;
}

export interface SpacecraftBusConfig {
  id: string;
  name: string;
  dry_mass_kg: number;
  cost_usd: number;
  avionics_power_w: number;
  isp_s: number;
  diameter_m: number;
}

export interface LaunchVehicle {
  id: string;
  name: string;
  /** Mass deliverable to trans-lunar injection (C3 ≈ −2 km²/s²). */
  tli_capacity_kg: number;
  fairing_diameter_m: number;
  cost_usd: number;
  description: string;
}

export interface LaunchpadConfig {
  id: string;
  name: string;
  mass_kg: number;
  cost_usd: number;
  deflection_efficiency: number;
  requires_standoff_distance_m: number;
  /** Continuous power drawn before first landing (sintered pad), W. */
  construction_power_w: number;
  construction_days: number;
  comm_range_extension_km: number;
  description: string;
}

export interface PowerMastConfig {
  id: string;
  name: string;
  height_m: number;
  mass_kg: number;
  cost_usd: number;
  rated_power_w: number;
  cutoff_elevation_deg: number;
}

export interface BatteryConfig {
  id: string;
  name: string;
  capacity_kwh: number;
  max_dod: number;
  mass_kg: number;
  cost_usd: number;
}

export interface CommConfig {
  id: string;
  name: string;
  mass_kg: number;
  cost_usd: number;
  tx_power_w: number;
  downlink_kbps: number;
  /** true = direct-to-Earth (needs Earth LoS); false = relay (uses relay_coverage_fraction). */
  direct_to_earth: boolean;
  relay_coverage_fraction: number | null;
}

export interface DataStorageConfig {
  id: string;
  name: string;
  capacity_mb: number;  // megabits
  mass_kg: number;
  cost_usd: number;
  power_w: number;
}

export interface LogisticsConfig {
  id: string;
  name: string;
  /** If true, mass and cost scale with route length (per-km fields used). */
  per_km: boolean;
  mass_kg: number;
  cost_usd: number;
  reliability_365d: number;
  max_slope_deg: number;
  survival_heater_w: number;
}

export interface UtilityLinkConfig {
  id: string;
  name: string;
  per_km: boolean;
  mass_kg: number;
  cost_usd: number;
  /** Optical output for a laser link, or rated feed for a cable, W. */
  source_power_w: number;
  efficiency: number;
  max_range_km: number | null;
  sever_probability: number;
  attenuated_by_dust: boolean;
}

export interface InstrumentConfig {
  id: string;
  name: string;
  mass_kg: number;
  cost_usd: number;
  peak_power_w: number;
  data_rate_kbps: number;
  science_value: number;
  enables_layers: Array<'slope' | 'ice_heatmap'>;
  extracts_ice: boolean;
  description: string;
}

export interface GraphicPlaceholderConfig {
  id: string;
  target_stage: PlaceholderStage;
  asset_path: string;
  aspect_ratio: AspectRatio;
  title: string;
  brief_explanation: string;
  fallback_badge: string;
}

export interface SideQuestConfig {
  id: string;
  phase: Phase;
  title: string;
  prompt: string;
  formula: string;
  hint: string;
  correct_value: number;
  tolerance: number;
  unit: string;
  explanation: string;
}

export interface PreStageQuestion {
  phase: Phase;
  question: string;
  explanation: string;
}

export interface ShortfallBadge {
  id: string;
  rank: number;
  title: string;
  awarded_when: string;
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export interface SimulationState {
  currentPhase: Phase;
  simulationHour: number; // 0 to 8760
  isSimulationRunning: boolean;
  difficulty: Difficulty;
  seed: number;
  teamMode: boolean;
  /** Which seat is active in hot-seat team mode (D-010). */
  activeRole: TeamRole | null;
  roleSignOffs: Partial<Record<Phase, TeamRole[]>>;
  missionObjective: string | null;

  selectedSite: string | null;
  selectedTrajectory: string | null;
  selectedBus: string | null;
  selectedLaunchVehicle: string | null;
  selectedLaunchpad: string | null;
  padDistanceM: number | null;
  selectedMast: string | null;
  selectedBattery: string | null;
  selectedComm: string | null;
  selectedStorage: string | null;
  selectedLogistics: string | null;
  selectedUtilityLink: string | null;
  drillHeaterW: number;
  selectedInstruments: string[];

  allocatedBudgetUSD: number;
  remainingBudgetUSD: number;
  totalWetMassKg: number;
  telemetryLog: SubsystemTelemetry[];
  gateResults: Partial<Record<Phase, GateValidationResult>>;
  userHypotheses: Partial<Record<Phase, string>>;
  completedQuests: string[];
}

export interface SubsystemTelemetry {
  hour: number;
  solarElevationDeg: number;
  solarPowerGeneratedW: number;
  batterySoCPercent: number;
  baseLoadW: number;
  heaterLoadW: number;
  isEclipse: boolean;
  earthLineOfSight: boolean;
  ssmmBufferOccupancyPercent: number;
  downlinkBandwidthKbps: number;
  cumulativeIceAssayedKg: number;
  /** Science frames lost to buffer overflow this hour, megabits. */
  droppedDataMb: number;
  events: string[];
}

export interface GateValidationResult {
  passed: boolean;
  gateName: string;
  governingStandard: string;
  reasonCode: string;
  diagnosticExplanation: string;
  remediationAction: string;
}

/** Derived budgets shown in the always-visible resource bar (challenge: six resources). */
export interface ResourceLedger {
  dryMassKg: number;
  contingencyMassKg: number;
  propellantMassKg: number;
  wetMassKg: number;
  launchCapacityKg: number;
  massMarginFraction: number;
  totalCostUSD: number;
  budgetUSD: number;
  eclipseEnergyRequiredWh: number;
  eclipseEnergyAvailableWh: number;
  powerMarginFraction: number;
  dataGeneratedMbPerDay: number;
  downlinkMbPerDay: number;
  missionDurationDays: number;
}

export interface MissionScore {
  gatesPassed: number;
  scienceScore: number;   // spec §3.4 S_score
  uptimeHours: number;
  dataCompleteness: number;
  budgetEfficiency: number;
  total: number;          // 0–1000, see docs/BUILD-PLAN.md §5
  badges: string[];
}

/** REQ-007: portable design blob for save / share / compare (and async team play). */
export interface MissionDesignExport {
  format: 'space-mission-simulator/design';
  version: 1;
  createdAt: string;
  teamName?: string;
  difficulty: Difficulty;
  seed: number;
  design: Pick<
    SimulationState,
    | 'missionObjective' | 'selectedSite' | 'selectedTrajectory' | 'selectedBus'
    | 'selectedLaunchVehicle' | 'selectedLaunchpad' | 'padDistanceM' | 'selectedMast'
    | 'selectedBattery' | 'selectedComm' | 'selectedStorage' | 'selectedLogistics'
    | 'selectedUtilityLink' | 'drillHeaterW' | 'selectedInstruments' | 'userHypotheses'
  >;
  /** Optional override of constants (REQ-007 difficulty / physics import). */
  constantsOverride?: Partial<EngineConstants>;
}
