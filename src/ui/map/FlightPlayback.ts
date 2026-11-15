import './flight-playback.css';
import type { EngineConstants, SimulationState } from '../../models/Interfaces';
import type { SimulationResult } from '../../engine/SimulationClock';
import { h } from '../dom';
import { renderSiteMap, type SiteMapHandle } from './SiteMap';
import { playbackEndHour, playbackEvents, rowAt } from './flightModel';
import { createFlightCharts, type ChartLevel, type FlightChartSpec } from './flightCharts';

/**
 * Operations replay (Lead, D-105, D-120): the 8,760 h year from runMission, replayed on the map
 * with the year's charts drawing themselves beside it.
 *
 *   const fp = createFlightPlayback(viewportEl, constants, state, result, { onFinish: () => showDebrief() });
 *   fp.destroy();
 *
 * The engine has already run the year; this only replays its telemetry, so playback speed never
 * changes the outcome. Left: the outpost on a square map (sun, shadows, rover, links) with the day
 * counter and event pop-ups. Right: live strip charts of the five things that decide the mission
 * (flightCharts.ts). Below: play/pause, speed and a scrubber.
 * Works with sampled telemetry (main.ts keeps one row every few hours): the row at or before the
 * current hour is shown.
 *
 * DOM ids for tests: #flight-playback, #btn-flight-play, #btn-flight-skip, #flight-scrubber,
 * #flight-day, #flight-outcome, #btn-flight-debrief.
 */

export interface FlightPlaybackOptions {
  /** Called when the player asks for the debrief (button at the end, or "Skip to results"). */
  onFinish?: () => void;
  /** Start playing at once (default true). */
  autoplay?: boolean;
}
export interface FlightPlaybackHandle {
  element: HTMLElement;
  play(): void;
  pause(): void;
  seek(hour: number): void;
  destroy(): void;
}

/** Presentation only: real seconds for the whole year at 1× (the default: calm enough to read, D-119). */
const YEAR_SECONDS_AT_1X = 120;
const SPEEDS = [1, 2, 4];
const DEFAULT_SPEED = 1;
/** How long an event pop-up stays on screen, ms. */
const TOAST_MS = 3500;
/** Data-memory readout turns amber above this fill, percent (display only). */
const DATA_WARN_PERCENT = 80;
const PERCENT = 100;

export function createFlightPlayback(
  container: HTMLElement, c: EngineConstants, state: SimulationState, result: SimulationResult, opts: FlightPlaybackOptions = {},
): FlightPlaybackHandle {
  const rows = result.telemetry;
  const endHour = playbackEndHour(c, result);
  const totalHours = c.simulation.mission_duration_h;
  const events = playbackEvents(result);
  const battery = state.selectedBattery ? c.hardware_catalog.energy_storage[state.selectedBattery] : null;

  let hour = 0;
  let speed = DEFAULT_SPEED;
  let playing = false;
  let raf = 0;
  let lastT = 0;
  let nextEvent = 0;
  let finished = false;

  // ---- DOM ------------------------------------------------------------------------------------
  const mapHost = h('div', { class: 'flight__map' });
  const day = h('div', { class: 'flight__day', id: 'flight-day', 'aria-live': 'off' });
  const toasts = h('div', { class: 'flight__toasts', 'aria-live': 'polite' });
  const outcome = h('div', { class: 'flight__outcome', id: 'flight-outcome', hidden: '' });

  const playBtn = h('button', { type: 'button', id: 'btn-flight-play', class: 'flight__play', 'aria-label': 'Play' }, '▶');
  const speedBtns = SPEEDS.map((s) => {
    const b = h('button', { type: 'button', class: 'flight__speed secondary', 'aria-pressed': String(s === speed) }, `${s}×`);
    b.addEventListener('click', () => { speed = s; speedBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(SPEEDS[i] === s))); });
    return b;
  });
  const scrub = h('input', { type: 'range', id: 'flight-scrubber', min: '0', max: String(totalHours), step: '1', value: '0', 'aria-label': 'Mission time' });
  const ticks = h('div', { class: 'flight__ticks', 'aria-hidden': 'true' });
  for (const e of events) {
    ticks.append(h('span', { class: `flight__tick is-${e.kind}`, style: `left:${(100 * e.hour) / totalHours}%`, title: e.text }));
  }
  if (result.failureHour != null) {
    ticks.append(h('span', { class: 'flight__tick is-end', style: `left:${(100 * result.failureHour) / totalHours}%` }));
  }
  const skipBtn = h('button', { type: 'button', id: 'btn-flight-skip', class: 'secondary' }, 'Skip to results');

  const chartsHost = h('div', { class: 'flight__side' });
  const root = h('div', { class: 'flight', id: 'flight-playback' },
    h('div', { class: 'flight__body' },
      h('div', { class: 'flight__stage' }, mapHost, day, toasts, outcome),
      chartsHost),
    h('div', { class: 'flight__bar' }, playBtn, ...speedBtns, h('div', { class: 'flight__track' }, ticks, scrub), skipBtn),
  );
  container.append(root);

  const map: SiteMapHandle = renderSiteMap(mapHost, c, state, { stage: 'FLY', hour: 0 });

  // ---- live charts ----------------------------------------------------------------------------
  const num = (v: number, digits = 0) => v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  let drilling = false;
  let failed = false;
  const specs: FlightChartSpec[] = [
    {
      id: 'battery', label: 'Battery', hint: 'Each dip is a lunar night on the battery. Touching 0% ends the mission.',
      value: (t) => t.batterySoCPercent, max: PERCENT,
      read: (t) => ({
        text: `${num(t.batterySoCPercent)}%${battery ? ` of ${battery.capacity_kwh} kWh` : ''}`,
        level: failed ? 'fail' : t.batterySoCPercent < c.simulation.drill_min_soc_percent ? 'warn' : 'ok',
      }),
    },
    {
      id: 'solar', label: 'Solar power', hint: 'What the mast harvests. The gaps are nights and dust.',
      value: (t) => t.solarPowerGeneratedW,
      read: (t) => ({ text: `${num(t.solarPowerGeneratedW)} W`, level: t.solarPowerGeneratedW > 0 ? 'ok' : 'off' }),
    },
    {
      id: 'data', label: 'Data memory', hint: 'Science piles up while Earth is out of view. At 100%, new science is lost.',
      value: (t) => t.ssmmBufferOccupancyPercent, max: PERCENT,
      read: (t) => ({
        text: `${num(t.ssmmBufferOccupancyPercent)}% full`,
        level: t.droppedDataMb > 0 ? 'fail' : t.ssmmBufferOccupancyPercent > DATA_WARN_PERCENT ? 'warn' : 'ok',
      }),
    },
    {
      id: 'earth', label: 'Earth link', hint: 'Downlink to Earth, only while Earth is above the horizon.',
      value: (t) => (t.earthLineOfSight ? t.downlinkBandwidthKbps : 0),
      read: (t) => ({ text: t.earthLineOfSight ? `${num(t.downlinkBandwidthKbps)} kbps` : 'no view', level: t.earthLineOfSight ? 'ok' : 'off' }),
    },
    {
      id: 'ice', label: 'Water ice', hint: 'The mission goal. Flat steps: no sunlight, no power or no delivery.',
      value: (t) => t.cumulativeIceAssayedKg,
      read: (t) => ({ text: `${num(t.cumulativeIceAssayedKg, 1)} kg`, level: (drilling ? 'ok' : 'off') as ChartLevel }),
    },
  ];
  const charts = createFlightCharts(rows, totalHours, specs, {
    failureHour: result.failureHour,
    onSeek: (hr) => { pause(); seek(hr); if (hour >= endHour && !finished) showOutcome(); },
  });
  chartsHost.append(charts.element);

  function render(): void {
    const i = rowAt(rows, hour);
    const t = i >= 0 ? rows[i] : null;
    const prev = i > 0 ? rows[i - 1] : null;
    failed = result.failureHour != null && hour >= result.failureHour;
    drilling = !!t && !!prev && t.cumulativeIceAssayedKg > prev.cumulativeIceAssayedKg && !failed;
    map.setHour(hour, { drilling, linkUp: !!t?.earthLineOfSight, failed });

    const d = Math.floor(hour / 24);
    day.replaceChildren(
      h('strong', {}, `Day ${d}`),
      h('span', {}, ` of ${Math.round(totalHours / 24)}`),
      h('em', { class: t?.isEclipse ? 'is-night' : 'is-day' }, t?.isEclipse ? ' · night' : ' · day'),
    );
    charts.setHour(hour, t);
  }

  // ---- events ---------------------------------------------------------------------------------
  function toast(text: string, kind: string): void {
    const el = h('div', { class: `flight__toast is-${kind}` }, h('strong', {}, `Day ${Math.floor(hour / 24)}`), ` ${text}`);
    toasts.prepend(el);
    while (toasts.children.length > 3) toasts.lastElementChild!.remove();
    window.setTimeout(() => el.classList.add('is-gone'), TOAST_MS);
    window.setTimeout(() => el.remove(), TOAST_MS + 400);
  }
  function fireEvents(): void {
    while (nextEvent < events.length && events[nextEvent].hour <= hour) {
      const e = events[nextEvent++];
      if (e.hour <= endHour) toast(e.text, e.kind);
    }
  }
  const resetEventCursor = () => { nextEvent = events.findIndex((e) => e.hour > hour); if (nextEvent < 0) nextEvent = events.length; };

  function showOutcome(): void {
    finished = true;
    const ok = result.failureHour == null;
    const why = result.failureCause === 'BROWNOUT' ? 'The battery ran flat during a lunar night and the heaters went off.'
      : result.failureCause === 'LOGISTICS_FAILURE' ? 'The ice-delivery system failed and could not be repaired.' : '';
    const debrief = h('button', { type: 'button', id: 'btn-flight-debrief' }, 'See the debrief');
    debrief.addEventListener('click', () => opts.onFinish?.());
    outcome.replaceChildren(
      h('h2', {}, ok ? 'The outpost survived the year' : `Outpost lost on day ${Math.floor(endHour / 24)}`),
      h('p', {}, ok
        ? `${result.iceKg.toFixed(1)} kg of water ice assayed · ${Math.round(result.uptimeHours).toLocaleString('en-US')} h up.`
        : why),
      debrief,
    );
    outcome.className = `flight__outcome ${ok ? 'is-ok' : 'is-fail'}`;
    outcome.hidden = false;
    debrief.focus();
  }

  // ---- clock ----------------------------------------------------------------------------------
  function frame(t: number): void {
    const dt = lastT ? (t - lastT) / 1000 : 0;
    lastT = t;
    hour = Math.min(endHour, hour + (dt * totalHours * speed) / YEAR_SECONDS_AT_1X);
    scrub.value = String(Math.floor(hour));
    fireEvents();
    render();
    if (hour >= endHour) { pause(); showOutcome(); return; }
    raf = requestAnimationFrame(frame);
  }
  function play(): void {
    if (playing) return;
    if (hour >= endHour) { hour = 0; resetEventCursor(); outcome.hidden = true; finished = false; }
    playing = true; lastT = 0;
    playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause');
    raf = requestAnimationFrame(frame);
  }
  function pause(): void {
    playing = false; cancelAnimationFrame(raf); raf = 0;
    playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play');
  }
  function seek(hr: number): void {
    hour = Math.max(0, Math.min(endHour, hr));
    scrub.value = String(Math.floor(hour));
    resetEventCursor();
    toasts.replaceChildren();
    if (hour < endHour) { outcome.hidden = true; finished = false; }
    render();
  }

  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  scrub.addEventListener('input', () => { pause(); seek(Number(scrub.value)); });
  scrub.addEventListener('change', () => { if (Number(scrub.value) >= endHour && !finished) showOutcome(); });
  skipBtn.addEventListener('click', () => { pause(); seek(endHour); if (!finished) showOutcome(); });
  root.addEventListener('keydown', (e) => {
    if (e.key === ' ' && (e.target === root || e.target === playBtn)) { e.preventDefault(); playing ? pause() : play(); }
  });
  root.tabIndex = -1;

  render();
  if (opts.autoplay ?? true) play();

  return {
    element: root,
    play, pause, seek,
    destroy() { pause(); map.destroy(); root.remove(); },
  };
}
