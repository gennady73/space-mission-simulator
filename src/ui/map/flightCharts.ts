import type { SubsystemTelemetry } from '../../models/Interfaces';
import { h } from '../dom';

/**
 * Live year charts for the operations replay (Lead, D-120): one strip per measure on a shared
 * time axis. Each line is drawn only up to the current hour, so the year writes itself as it
 * runs; lunar nights are shaded, and a tap or drag on any strip jumps the replay to that day.
 *
 *   const charts = createFlightCharts(rows, totalHours, specs, { failureHour, onSeek });
 *   charts.setHour(hour, row);
 *
 * Presentation only: every value comes from the engine's telemetry rows.
 */

const SVG = 'http://www.w3.org/2000/svg';
/** Plot box in SVG user units; the SVG stretches to its strip, strokes keep their width. */
const W = 1000, H = 100;
/** Charts keep one row in this many hours: finer than a screen pixel at any panel width. */
const SAMPLE_HOURS = 2;
const AXIS_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

export type ChartLevel = 'ok' | 'warn' | 'fail' | 'off';

export interface FlightChartSpec {
  id: string;
  label: string;
  /** One line under the label: what the strip shows and why it matters. */
  hint: string;
  value: (row: SubsystemTelemetry) => number;
  /** Fixed top of the axis; otherwise the largest value of the year. */
  max?: number;
  /** Live readout for the row at the current hour, and its status colour. */
  read: (row: SubsystemTelemetry) => { text: string; level: ChartLevel };
}

export interface FlightChartsOptions {
  /** Hour the outpost was lost, marked on every strip. */
  failureHour?: number | null;
  /** The player tapped or dragged on a strip. */
  onSeek?: (hour: number) => void;
}

export interface FlightChartsHandle {
  element: HTMLElement;
  setHour(hour: number, row: SubsystemTelemetry | null): void;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Runs of eclipse hours as [start, end) pairs. */
export function nightSpans(rows: SubsystemTelemetry[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = -1;
  for (const r of rows) {
    if (r.isEclipse && start < 0) start = r.hour;
    if (!r.isEclipse && start >= 0) { spans.push([start, r.hour]); start = -1; }
  }
  if (start >= 0 && rows.length) spans.push([start, rows[rows.length - 1].hour + 1]);
  return spans;
}

export function createFlightCharts(
  rows: SubsystemTelemetry[], totalHours: number, specs: FlightChartSpec[], opts: FlightChartsOptions = {},
): FlightChartsHandle {
  const x = (hour: number) => (W * hour) / totalHours;
  const nights = nightSpans(rows);
  const sampled = rows.filter((r, i) => r.hour % SAMPLE_HOURS === 0 || i === rows.length - 1);
  const days = Math.round(totalHours / 24);

  const strips = specs.map((spec) => {
    const top = spec.max ?? Math.max(1, ...rows.map(spec.value));
    const y = (v: number) => H * (1 - Math.min(v, top) / top);

    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'fchart__plot', 'aria-hidden': 'true' });
    root.append(svg('line', { x1: 0, x2: W, y1: H / 2, y2: H / 2, class: 'fchart__grid' }));
    // Everything in `past` is clipped at the current hour (a nested <svg> clips to its own width).
    const past = svg('svg', { x: 0, y: 0, width: 0, height: H, class: 'fchart__past' });
    for (const [a, b] of nights) past.append(svg('rect', { x: x(a), y: 0, width: Math.max(1, x(b) - x(a)), height: H, class: 'fchart__night' }));
    const pts = sampled.map((r) => `${x(r.hour).toFixed(1)},${y(spec.value(r)).toFixed(1)}`).join(' ');
    past.append(svg('polygon', { points: `0,${H} ${pts} ${x(sampled[sampled.length - 1]?.hour ?? 0).toFixed(1)},${H}`, class: 'fchart__area' }));
    past.append(svg('polyline', { points: pts, class: 'fchart__line' }));
    root.append(past);
    if (opts.failureHour != null) {
      const fx = x(Math.min(opts.failureHour, totalHours));
      root.append(svg('line', { x1: fx, x2: fx, y1: 0, y2: H, class: 'fchart__lost' }));
    }
    const cursor = svg('line', { x1: 0, x2: 0, y1: 0, y2: H, class: 'fchart__cursor' });
    root.append(cursor);

    const value = h('strong', {});
    const el = h('div', { class: 'fchart', id: `flight-chart-${spec.id}`, title: spec.hint },
      h('div', { class: 'fchart__head' }, h('span', {}, spec.label), value, h('em', {}, spec.hint)),
      h('div', { class: 'fchart__box' },
        h('span', { class: 'fchart__max' }, top.toLocaleString('en-US', { maximumFractionDigits: 0 })),
        root as unknown as HTMLElement));

    if (opts.onSeek) {
      const seek = (e: PointerEvent) => {
        const box = root.getBoundingClientRect();
        if (box.width > 0) opts.onSeek!(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * totalHours);
      };
      root.addEventListener('pointerdown', (e) => { root.setPointerCapture(e.pointerId); seek(e); });
      root.addEventListener('pointermove', (e) => { if (e.buttons) seek(e); });
    }
    return { spec, el, past, cursor, value };
  });

  const axis = h('div', { class: 'fchart__axis', 'aria-hidden': 'true' },
    ...AXIS_FRACTIONS.map((f) => h('span', {}, `day ${Math.round(days * f)}`)));
  const element = h('div', { class: 'flight__charts', role: 'group', 'aria-label': 'The year so far, hour by hour' },
    ...strips.map((s) => s.el), axis,
    h('p', { class: 'fchart__note' }, 'Shaded bands are lunar nights. Tap a chart to jump to that day.'));

  return {
    element,
    setHour(hour, row) {
      const px = x(Math.max(0, Math.min(totalHours, hour)));
      for (const s of strips) {
        s.past.setAttribute('width', px.toFixed(1));
        s.cursor.setAttribute('x1', px.toFixed(1));
        s.cursor.setAttribute('x2', px.toFixed(1));
        if (row) {
          const r = s.spec.read(row);
          s.value.textContent = r.text;
          s.el.dataset.level = r.level;
        }
      }
    },
  };
}
