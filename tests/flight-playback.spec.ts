import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConstants } from '../src/engine/ConstantsLoader';
import { runMission } from '../src/engine/SimulationClock';
import { provisionalDesign } from '../src/ui/DesignFlow';
import { initialState, REFERENCE_DESIGN } from '../src/models/StateStore';
import { playbackEndHour, playbackEvents, rowAt } from '../src/ui/map/flightModel';
import { nightSpans } from '../src/ui/map/flightCharts';

const c = parseConstants(JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8')));

describe('flight playback model (D-105)', () => {
  const rows = [0, 6, 12, 18].map((hour) => ({ hour }) as never);

  it('finds the telemetry row at or before an hour', () => {
    expect(rowAt(rows, 0)).toBe(0);
    expect(rowAt(rows, 5.9)).toBe(0);
    expect(rowAt(rows, 6)).toBe(1);
    expect(rowAt(rows, 17)).toBe(2);
    expect(rowAt(rows, 1e6)).toBe(3);
    expect(rowAt([], 3)).toBe(-1);
  });

  it('replays a full year for a design that survives, with milestones in time order', () => {
    const state = { ...initialState(c), ...REFERENCE_DESIGN };
    const { design } = provisionalDesign(c, state);
    expect(design).toBeTruthy();
    const r = runMission(c, design!, { seed: state.seed, randomEvents: true, logEveryHours: 6 });
    expect(playbackEndHour(c, r)).toBe(r.failureHour ?? c.simulation.mission_duration_h);
    const ev = playbackEvents(r);
    expect(ev.length).toBeGreaterThanOrEqual(r.events.length);
    expect(ev.every((e, i) => i === 0 || ev[i - 1].hour <= e.hour)).toBe(true);
  });

  it('stops the replay at the failure hour', () => {
    const fake = { failureHour: 1234, events: [], telemetry: [] } as never;
    expect(playbackEndHour(c, fake)).toBe(1234);
  });
});

describe('live year charts (D-120)', () => {
  it('groups eclipse hours into night bands, one per lunar night of the reference year', () => {
    const state = { ...initialState(c), ...REFERENCE_DESIGN };
    const { design } = provisionalDesign(c, state);
    const r = runMission(c, design!, { seed: state.seed, randomEvents: false, logEveryHours: 1 });
    const spans = nightSpans(r.telemetry);
    expect(spans.length).toBeGreaterThan(0);
    const eclipseHours = r.telemetry.filter((t) => t.isEclipse).length;
    expect(spans.reduce((a, [from, to]) => a + (to - from), 0)).toBe(eclipseHours);
    for (const [from, to] of spans) expect(to).toBeGreaterThan(from);
  });

  it('closes a night that is still running when the telemetry ends', () => {
    const rows = [{ hour: 0, isEclipse: false }, { hour: 1, isEclipse: true }, { hour: 2, isEclipse: true }] as never;
    expect(nightSpans(rows)).toEqual([[1, 3]]);
  });
});
