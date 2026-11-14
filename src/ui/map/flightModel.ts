import type { EngineConstants, SubsystemTelemetry } from '../../models/Interfaces';
import type { SimulationResult } from '../../engine/SimulationClock';

/** Pure helpers for the flight playback (Lead, D-105). No DOM, so unit tests can import them. */

export type PlaybackEventKind = 'info' | 'good' | 'bad';
export interface PlaybackEvent { hour: number; text: string; kind: PlaybackEventKind }

/** Index of the last row whose hour is ≤ hour (rows sorted by hour). */
export function rowAt(rows: SubsystemTelemetry[], hour: number): number {
  let lo = 0, hi = rows.length - 1;
  if (hi < 0) return -1;
  if (hour <= rows[0].hour) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid].hour <= hour) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Hour at which the replay stops: the failure hour, or the end of the year. */
export function playbackEndHour(c: EngineConstants, r: SimulationResult): number {
  return r.failureHour ?? c.simulation.mission_duration_h;
}

/** Milestones the replay announces, from the engine's events plus a few derived from telemetry. */
export function playbackEvents(r: SimulationResult): PlaybackEvent[] {
  const out: PlaybackEvent[] = [];
  const rows = r.telemetry;
  const firstNight = rows.find((t) => t.isEclipse);
  if (firstNight) out.push({ hour: firstNight.hour, text: 'First lunar night: the outpost drops to survival mode', kind: 'info' });
  const firstIce = rows.find((t) => t.cumulativeIceAssayedKg > 0);
  if (firstIce) out.push({ hour: firstIce.hour, text: 'First water ice assayed in the cold trap', kind: 'good' });
  const firstDrop = rows.find((t) => t.droppedDataMb > 0);
  if (firstDrop) out.push({ hour: firstDrop.hour, text: 'Data memory full: science is being lost until Earth is back in view', kind: 'bad' });
  for (const e of r.events) {
    const bad = /fail|depleted|brownout|snag/i.test(e.text);
    out.push({ hour: e.hour, text: e.text, kind: bad ? 'bad' : 'info' });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

