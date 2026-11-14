import type { SubsystemTelemetry } from '../models/Interfaces';

/**
 * Strip charts for the flight year: one measure per chart, shared time axis, so no chart
 * needs two y-scales. Each chart is a single series named by its title. Hover shows the
 * value at that hour; the same numbers are in the event list and the raw result below.
 */

const SVG = 'http://www.w3.org/2000/svg';
const W = 720, H = 130, LEFT = 44, RIGHT = 12, TOP = 10, BOTTOM = 22;

export interface StripSpec {
  title: string;
  unit: string;
  value: (row: SubsystemTelemetry) => number;
  /** Fixed upper bound of the axis; otherwise the data maximum is used. */
  max?: number;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** A moment worth marking on every chart, such as the hour the outpost was lost. */
export interface StripMarker { hour: number; label: string }

export function renderStripChart(rows: SubsystemTelemetry[], spec: StripSpec, totalHours: number, marker?: StripMarker | null): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'strip-chart';
  const caption = document.createElement('figcaption');
  caption.textContent = `${spec.title} (${spec.unit})`;
  const readout = document.createElement('span');
  readout.className = 'strip-readout';
  caption.append(readout);

  const values = rows.map(spec.value);
  const top = spec.max ?? Math.max(1, ...values);
  const x = (hour: number) => LEFT + ((W - LEFT - RIGHT) * hour) / totalHours;
  const y = (v: number) => TOP + (H - TOP - BOTTOM) * (1 - Math.min(v, top) / top);

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${spec.title} over the mission, in ${spec.unit}` });
  for (const fraction of [0, 0.5, 1]) {
    const gy = y(top * fraction);
    root.append(svg('line', { x1: LEFT, x2: W - RIGHT, y1: gy, y2: gy, class: 'strip-grid' }));
    const label = svg('text', { x: LEFT - 6, y: gy + 4, 'text-anchor': 'end', class: 'strip-tick' });
    label.textContent = (top * fraction).toLocaleString('en-US', { maximumFractionDigits: 0 });
    root.append(label);
  }
  const days = totalHours / 24;
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const label = svg('text', { x: x(totalHours * fraction), y: H - 6, 'text-anchor': fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle', class: 'strip-tick' });
    label.textContent = `day ${Math.round(days * fraction)}`;
    root.append(label);
  }
  root.append(svg('polyline', { points: rows.map((r, i) => `${x(r.hour).toFixed(1)},${y(values[i]).toFixed(1)}`).join(' '), class: 'strip-line' }));

  if (marker) {
    const mx = x(Math.min(marker.hour, totalHours));
    root.append(svg('line', { x1: mx, x2: mx, y1: TOP, y2: H - BOTTOM, class: 'strip-marker' }));
    const nearEnd = mx > W - RIGHT - 120;
    const label = svg('text', { x: nearEnd ? mx - 5 : mx + 5, y: TOP + 10, 'text-anchor': nearEnd ? 'end' : 'start', class: 'strip-marker-label' });
    label.textContent = marker.label;
    root.append(label);
  }

  const cursor = svg('line', { y1: TOP, y2: H - BOTTOM, class: 'strip-cursor', visibility: 'hidden' });
  const dot = svg('circle', { r: 4, class: 'strip-dot', visibility: 'hidden' });
  const hit = svg('rect', { x: LEFT, y: TOP, width: W - LEFT - RIGHT, height: H - TOP - BOTTOM, fill: 'transparent' });
  root.append(cursor, dot, hit);

  const show = (clientX: number) => {
    const box = root.getBoundingClientRect();
    const hour = ((((clientX - box.left) / box.width) * W - LEFT) / (W - LEFT - RIGHT)) * totalHours;
    let nearest = 0;
    for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i].hour - hour) < Math.abs(rows[nearest].hour - hour)) nearest = i;
    const row = rows[nearest];
    if (!row) return;
    cursor.setAttribute('x1', String(x(row.hour)));
    cursor.setAttribute('x2', String(x(row.hour)));
    dot.setAttribute('cx', String(x(row.hour)));
    dot.setAttribute('cy', String(y(values[nearest])));
    cursor.setAttribute('visibility', 'visible');
    dot.setAttribute('visibility', 'visible');
    readout.textContent = ` · day ${Math.floor(row.hour / 24)}, hour ${row.hour % 24}: ${values[nearest].toLocaleString('en-US', { maximumFractionDigits: 1 })} ${spec.unit}`;
  };
  hit.addEventListener('pointermove', (e) => show(e.clientX));
  hit.addEventListener('pointerleave', () => {
    cursor.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    readout.textContent = '';
  });

  figure.append(caption, root);
  return figure;
}
