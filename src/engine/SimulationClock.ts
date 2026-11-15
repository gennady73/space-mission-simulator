import type { EngineConstants, MissionScore, SubsystemTelemetry } from '../models/Interfaces';
import { createPrng } from './Prng';
import {
  drillPeakW, hasLink, solarElevationDeg, solarPowerW, survivalLoadW,
  totalCostUSD, utilityLinkPower, type ResolvedDesign,
} from './SubsystemEngines';
import { validatePLAR } from './StageGateValidators';

/**
 * REQ-001 / REQ-002: deterministic 8,760 h run, four segments updated each 1 h tick.
 * Pure function: same constants + design + seed + options => identical result.
 *
 * Operating rules (D-018):
 *  - Sunlit hours: full operations (drill, science, downlink when there is a link).
 *  - Shadow hours: survival mode (avionics + heaters + comm idle + storage + rover heater).
 *  - Drill runs only when sunlit, battery ≥ drill_min_soc_percent, logistics alive, link delivers peak,
 *    and the drill heater is ≥ min_drill_heater_w (otherwise it is frozen).
 *  - Battery at 0 Wh => terminal brownout (mission ends).
 *  - D-039: a logistics failure is permanent, unless the design has fault protection: then it is safed, and
 *    after recovery_link_hours of Earth contact the ground team recovers it with recovery_probability.
 */

export interface SimulationOptions {
  seed: number;
  randomEvents: boolean;
  /** Arrays scoured by plume at touchdown (only possible in sandbox when SRR was overridden). */
  arraysScoured?: boolean;
  /** Keep every hour in the log (8,760 rows) or only every Nth hour to save memory. */
  logEveryHours?: number;
}

export type FailureCause = 'BROWNOUT' | 'LOGISTICS_FAILURE' | null;

export interface SimulationResult {
  uptimeHours: number;
  failureCause: FailureCause;
  failureHour: number | null;
  iceKg: number;
  drillHours: number;
  dataGeneratedMb: number;
  dataDroppedMb: number;
  minSoCPercent: number;
  eclipseHours: number;
  linkHours: number;
  events: Array<{ hour: number; text: string }>;
  telemetry: SubsystemTelemetry[];
}

export function runMission(c: EngineConstants, r: ResolvedDesign, opt: SimulationOptions): SimulationResult {
  const s = c.simulation;
  const rand = createPrng(opt.seed);
  const H = s.mission_duration_h;
  const capWh = r.battery.capacity_kwh * 1000;
  const bufCapMb = r.storage.capacity_mb;
  const survivalW = survivalLoadW(c, r);
  const peakDrill = drillPeakW(r);
  const hasDrill = peakDrill > 0;
  const otherInstrW = r.instruments.filter((i) => !i.extracts_ice).reduce((a, i) => a + i.peak_power_w, 0);
  const drillKbps = r.instruments.filter((i) => i.extracts_ice).reduce((a, i) => a + i.data_rate_kbps, 0);
  const otherKbps = r.instruments.filter((i) => !i.extracts_ice).reduce((a, i) => a + i.data_rate_kbps, 0);
  const heaterOk = r.drillHeaterW >= s.min_drill_heater_w;
  const baseDust = opt.arraysScoured ? s.dust_transmission_scoured : s.dust_transmission_nominal;
  const synodicH = c.system_constants.synodic_month_days * 24;
  const constructionH = r.launchpad.construction_days * 24;

  // --- Pre-rolled random events (deterministic) ---------------------------------
  const events: Array<{ hour: number; text: string }> = [];
  const dustUntil = new Set<number>();
  let cableRepairUntil = -1;
  let logisticsFailHour = Infinity;
  let recoverable = false;
  if (opt.randomEvents) {
    for (let cycleStart = 0; cycleStart < H; cycleStart += synodicH) {
      if (rand() < s.dust_event_probability_per_cycle) {
        const start = Math.floor(cycleStart + rand() * (synodicH - s.dust_event_duration_h));
        for (let h = start; h < start + s.dust_event_duration_h; h++) dustUntil.add(h);
        events.push({ hour: start, text: `Dust-raising event: beam transmittance ${s.dust_event_beam_transmittance} for ${s.dust_event_duration_h} h` });
      }
    }
    if (r.utilityLink && r.utilityLink.sever_probability > 0 && rand() < r.utilityLink.sever_probability) {
      const at = Math.floor(rand() * 24 * 30);
      cableRepairUntil = at + 24 * 30;
      events.push({ hour: at, text: 'Umbilical cable snagged on boulder field — 30 days without drill power while it is re-routed' });
    }
    if (r.logistics) {
      const lambda = -Math.log(r.logistics.reliability_365d) / H;
      const t = -Math.log(1 - rand()) / lambda;
      if (t < H) {
        logisticsFailHour = Math.floor(t);
        // D-039: with fault protection the failure is safed, and may be recoverable once the ground has had enough Earth contact.
        // The extra draw happens only with fault protection, so runs without it keep their exact random sequence.
        if (r.faultProtection) {
          recoverable = rand() < r.faultProtection.recovery_probability;
          events.push({ hour: logisticsFailHour, text: `${r.logistics.name} failed; fault protection put it in safe mode and is waiting for the ground team` });
        } else {
          events.push({ hour: logisticsFailHour, text: `${r.logistics.name} failed permanently (reliability ${r.logistics.reliability_365d})` });
        }
      }
    }
  }

  // --- Hourly loop ----------------------------------------------------------------
  let eWh = capWh; // launch fully charged
  let bufMb = 0;
  let ice = 0, drillHours = 0, genMb = 0, dropMb = 0, eclipseHours = 0, linkHours = 0;
  let minSoC = 100;
  // D-039: Earth-contact hours the ground team has had since a safed logistics failure, and when it was recovered.
  let recoveryLinkHours = 0;
  let recoveredAt = Infinity;
  let recoveryVerdict = false;
  let failureCause: FailureCause = null, failureHour: number | null = null;
  const telemetry: SubsystemTelemetry[] = [];
  const every = opt.logEveryHours ?? 1;

  for (let h = 0; h < H; h++) {
    const hourEvents: string[] = [];
    const alpha = solarElevationDeg(c, r.site, h);
    const genW = solarPowerW(r.mast, alpha, baseDust);
    const eclipse = genW === 0;
    if (eclipse) eclipseHours++;
    const dust = dustUntil.has(h);
    const link = hasLink(c, r, h);
    if (link) linkHours++;

    // D-020: pad sintering only runs in sunlight (it is deferrable work)
    let loadW = survivalW + (h < constructionH && !eclipse ? r.launchpad.construction_power_w : 0);
    let drilling = false;
    let downKbps = 0;
    if (r.faultProtection && h >= logisticsFailHour && recoveredAt === Infinity && link) {
      recoveryLinkHours++;
      if (recoveryLinkHours === r.faultProtection.recovery_link_hours) {
        const days = Math.ceil((h - logisticsFailHour) / 24);
        if (recoverable) {
          recoveredAt = h;
          events.push({ hour: h, text: `Ground team recovered the ${r.logistics?.name ?? 'ice delivery'} after ${days} days in safe mode` });
        } else if (!recoveryVerdict) {
          recoveryVerdict = true;
          events.push({ hour: h, text: `Ground team could not recover the ${r.logistics?.name ?? 'ice delivery'} after ${days} days in safe mode` });
        }
      }
    }
    const logisticsAlive = h < logisticsFailHour || h >= recoveredAt;
    const cableOk = h >= cableRepairUntil;
    if (!eclipse) {
      loadW += otherInstrW;
      if (link) { loadW += r.comm.tx_power_w; downKbps = r.comm.downlink_kbps; }
      const linkP = utilityLinkPower(r, dust ? s.dust_event_beam_transmittance : 1);
      const socPct = (eWh / capWh) * 100;
      if (hasDrill && heaterOk && logisticsAlive && cableOk && linkP.deliveredW >= peakDrill && socPct >= s.drill_min_soc_percent) {
        drilling = true;
        loadW += r.utilityLink ? linkP.drawW : peakDrill;
      }
    }

    eWh = Math.min(capWh, eWh + (genW - loadW));
    if (eWh <= 0) {
      eWh = 0; failureCause = 'BROWNOUT'; failureHour = h;
      events.push({ hour: h, text: 'Battery depleted — heaters off, terminal brownout' });
    }

    // Data (ground segment)
    const inKbps = (eclipse ? 0 : otherKbps) + (drilling ? drillKbps : 0);
    const inMb = (inKbps * 3600) / 1000;
    const outMb = (downKbps * 3600) / 1000;
    genMb += inMb;
    bufMb = Math.max(0, bufMb + inMb - outMb);
    let droppedMb = 0;
    if (bufMb > bufCapMb) { droppedMb = bufMb - bufCapMb; dropMb += droppedMb; bufMb = bufCapMb; }

    // User segment
    if (drilling) { ice += s.ice_assay_rate_kg_h; drillHours++; }

    const soc = (eWh / capWh) * 100;
    minSoC = Math.min(minSoC, soc);
    if (h % every === 0 || failureCause) {
      telemetry.push({
        hour: h, solarElevationDeg: alpha, solarPowerGeneratedW: genW, batterySoCPercent: soc,
        baseLoadW: survivalW, heaterLoadW: r.drillHeaterW + (r.logistics?.survival_heater_w ?? 0),
        isEclipse: eclipse, earthLineOfSight: link, ssmmBufferOccupancyPercent: (bufMb / bufCapMb) * 100,
        downlinkBandwidthKbps: downKbps, cumulativeIceAssayedKg: ice, droppedDataMb: droppedMb, events: hourEvents,
      });
    }
    if (failureCause) break;
  }

  return {
    uptimeHours: failureHour ?? H, failureCause, failureHour, iceKg: ice, drillHours,
    dataGeneratedMb: genMb, dataDroppedMb: dropMb, minSoCPercent: minSoC, eclipseHours, linkHours,
    events: events.sort((a, b) => a.hour - b.hour), telemetry,
  };
}

/**
 * Mission score 0–1000 (game rule, docs/BUILD-PLAN.md §5):
 *   300 × gates passed / 5
 * + 400 × science (spec §3.4 S_score, capped at 1, × instrument science factor)
 * + 200 × budget efficiency (share of budget left, ×2, capped at 1)
 * + 100 × data completeness
 */
export function scoreMission(c: EngineConstants, r: ResolvedDesign, res: SimulationResult, gatesPassed: number, budgetUSD: number): MissionScore {
  const s = c.simulation;
  const H = s.mission_duration_h;
  const completeness = res.dataGeneratedMb > 0 ? 1 - res.dataDroppedMb / res.dataGeneratedMb : 0;
  const sScore = (res.iceKg / s.ice_score_normaliser_kg) * (res.uptimeHours / H) * completeness;
  const maxSci = Object.values(c.hardware_catalog.science_instruments).reduce((a, i) => a + i.science_value, 0);
  const sciFactor = r.instruments.reduce((a, i) => a + i.science_value, 0) / maxSci;
  const cost = totalCostUSD(r);
  const budgetEff = Math.max(0, Math.min(1, ((budgetUSD - cost) / budgetUSD) * 2));
  const plar = validatePLAR(res.uptimeHours, H, cost, budgetUSD);
  const gates = gatesPassed + (plar.passed ? 1 : 0);
  const total = Math.round(300 * (gates / 5) + 400 * Math.min(1, sScore) * sciFactor + 200 * budgetEff + 100 * completeness);

  const badges: string[] = [];
  if (gates >= 3 && res.failureCause !== 'BROWNOUT' && res.uptimeHours >= H) badges.push('SF02');
  if (gates >= 2 && r.launchpad.deflection_efficiency >= 0.8) badges.push('SF03');
  if (r.mast.id.includes('vsat') && r.launchpad.mass_kg > 0) badges.push('SF04');
  if (res.iceKg >= 500) badges.push('SF05');
  if (r.logistics?.id === 'hts_maglev_guideway' && res.uptimeHours >= H && res.failureCause === null) badges.push('SF16');
  if (r.launchpad.comm_range_extension_km > 0) badges.push('SF24');

  return { gatesPassed: gates, scienceScore: sScore, uptimeHours: res.uptimeHours, dataCompleteness: completeness, budgetEfficiency: budgetEff, total, badges };
}
