import type { EngineConstants, Provenance, SourceTier } from '../models/Interfaces';

/**
 * Pure data behind the "About & Numbers" page (design guide §4, rules 1, 3, 7, 9):
 * every number in engine-constants.json, with its source, tier and unit.
 * No DOM here, so it is unit-tested (tests/about-numbers.spec.ts).
 */

export const TIER_ORDER: SourceTier[] = ['nasa-doc', 'physical-constant', 'literature', 'spec-provisional', 'game-rule'];

export const TIER_LABELS: Record<SourceTier, { label: string; meaning: string }> = {
  'nasa-doc': { label: 'NASA document', meaning: 'Taken from a NASA standard, report or data product and checked against it.' },
  'physical-constant': { label: 'Physical constant', meaning: 'A measured constant of nature or of the Moon.' },
  literature: { label: 'Literature', meaning: 'From published science or engineering literature.' },
  'spec-provisional': { label: 'Provisional', meaning: 'From our game specification; plausible but not yet checked against a primary source.' },
  'game-rule': { label: 'Game rule', meaning: 'Chosen by the team to make the game work. Not a NASA value.' },
};

export interface NumberRow {
  path: string;
  label: string;
  value: number;
  display: string; // value formatted with its unit
}

export interface ProvenanceGroup {
  key: string;
  provenance: Provenance;
  rows: NumberRow[];
}

/** All numeric leaves outside `provenance`, as [path, value]. Booleans are not numbers. */
export function collectNumbers(c: EngineConstants): Array<{ path: string; value: number }> {
  const out: Array<{ path: string; value: number }> = [];
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'number') out.push({ path, value: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k);
  };
  for (const [k, v] of Object.entries(c)) if (k !== 'provenance') walk(v, k);
  return out;
}

/** Longest provenance key that equals the path or is a dotted prefix of it. */
export function provenanceKeyFor(c: EngineConstants, path: string): string | null {
  let best: string | null = null;
  for (const key of Object.keys(c.provenance)) {
    if ((path === key || path.startsWith(key + '.')) && (!best || key.length > best.length)) best = key;
  }
  return best;
}

/** Numbers with no provenance at all. Must stay empty (unit test). */
export function uncoveredNumbers(c: EngineConstants): string[] {
  return collectNumbers(c).filter((n) => provenanceKeyFor(c, n.path) === null).map((n) => n.path);
}

/** Provenance keys that point at nothing (typos). Must stay empty (unit test). */
export function danglingProvenanceKeys(c: EngineConstants): string[] {
  const paths = collectNumbers(c).map((n) => n.path);
  return Object.keys(c.provenance).filter((k) => !paths.some((p) => p === k || p.startsWith(k + '.')));
}

export function buildProvenanceGroups(c: EngineConstants): ProvenanceGroup[] {
  const groups = new Map<string, ProvenanceGroup>();
  for (const key of Object.keys(c.provenance)) groups.set(key, { key, provenance: c.provenance[key], rows: [] });
  for (const n of collectNumbers(c)) {
    const key = provenanceKeyFor(c, n.path);
    if (!key) continue;
    groups.get(key)!.rows.push({ path: n.path, label: labelFor(c, n.path, key), value: n.value, display: formatValue(c, n.path, n.value) });
  }
  return [...groups.values()].filter((g) => g.rows.length > 0)
    .sort((a, b) => TIER_ORDER.indexOf(a.provenance.tier) - TIER_ORDER.indexOf(b.provenance.tier) || a.key.localeCompare(b.key));
}

/** How many numbers sit in each tier. */
export function tierCounts(c: EngineConstants): Record<SourceTier, number> {
  const counts = Object.fromEntries(TIER_ORDER.map((t) => [t, 0])) as Record<SourceTier, number>;
  for (const n of collectNumbers(c)) {
    const key = provenanceKeyFor(c, n.path);
    if (key) counts[c.provenance[key].tier]++;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Units and labels (rule 7: units in every label)
// ---------------------------------------------------------------------------

/** Suffix → unit. Longer suffixes first. */
const UNIT_SUFFIXES: Array<[string, string]> = [
  ['_w_m2_k4', 'W/(m²·K⁴)'], ['_m_s2', 'm/s²'], ['_w_m2', 'W/m²'], ['_mj_kg', 'MJ/kg'], ['_kg_h', 'kg/h'],
  ['_m_s', 'm/s'], ['_kwh', 'kWh'], ['_kbps', 'kbps'], ['_mb', 'Mb'], ['_days', 'd'], ['_deg', '°'],
  ['_km', 'km'], ['_kg', 'kg'], ['_usd', 'USD'], ['_percent', '%'], ['_h', 'h'], ['_k', 'K'], ['_w', 'W'],
  ['_m', 'm'], ['_s', 's'], ['_fraction', ''],
];

export function unitFor(c: EngineConstants, path: string): string {
  const leaf = path.split('.').pop() ?? '';
  const quest = /^side_quests\.([^.]+)\.(correct_value|tolerance)$/.exec(path);
  if (quest) return c.side_quests[quest[1]]?.unit ?? '';
  for (const [suffix, unit] of UNIT_SUFFIXES) if (leaf.endsWith(suffix)) return unit;
  return '';
}

/** Dimensionless fractions shown as percentages (0.15 → 15%). */
const PERCENT_KEY = /(margin|fraction|efficiency|reliability|probability|max_dod|transmission|transmittance)/;

/** Leaves that scale with route length when their catalog item has `per_km: true` (maglev guideway, umbilical cable). */
const PER_KM_LEAVES = new Set(['mass_kg', 'cost_usd']);

/** True when the number at `path` is a per-kilometre figure: its parent item carries `per_km: true`. */
function isPerKm(c: EngineConstants, path: string): boolean {
  const parts = path.split('.');
  if (!PER_KM_LEAVES.has(parts.pop() ?? '')) return false;
  let obj: unknown = c;
  for (const k of parts) obj = obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[k] : undefined;
  return !!obj && typeof obj === 'object' && (obj as { per_km?: unknown }).per_km === true;
}

export function formatValue(c: EngineConstants, path: string, value: number): string {
  const base = formatPlain(c, path, value);
  return isPerKm(c, path) ? `${base} per km` : base;
}

function formatPlain(c: EngineConstants, path: string, value: number): string {
  const leaf = path.split('.').pop() ?? '';
  if (PERCENT_KEY.test(leaf) && value >= 0 && value <= 1) {
    return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  }
  const unit = unitFor(c, path);
  if (unit === 'USD') {
    return value >= 1e6 ? `$${(value / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M` : `$${value.toLocaleString('en-US')}`;
  }
  const abs = Math.abs(value);
  const text = abs !== 0 && (abs < 1e-3 || abs >= 1e7)
    ? value.toExponential(4)
    : value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  if (!unit) return text;
  return unit === '°' ? `${text}°` : `${text} ${unit}`;
}

const humanize = (s: string) => s.replace(/_/g, ' ');

/** "10 m telescoping VSAT mast · mass kg" style labels; uses catalog `name` where there is one. */
export function labelFor(c: EngineConstants, path: string, groupKey: string): string {
  const rest = path === groupKey ? path.split('.').pop()! : path.slice(groupKey.length + 1);
  const parts = rest.split('.');
  let leafKey = parts.pop()!;
  for (const [suffix] of UNIT_SUFFIXES) if (leafKey.endsWith(suffix)) { leafKey = leafKey.slice(0, -suffix.length); break; }
  const leaf = humanize(leafKey);
  if (parts.length === 0) return leaf;
  // Resolve the parent object to find a display name.
  let obj: unknown = c;
  for (const seg of (groupKey + '.' + parts.join('.')).split('.')) obj = (obj as Record<string, unknown> | undefined)?.[seg];
  const name = obj && typeof obj === 'object' && 'name' in obj ? String((obj as { name: unknown }).name)
    : obj && typeof obj === 'object' && 'label' in obj ? String((obj as { label: unknown }).label)
    : obj && typeof obj === 'object' && 'title' in obj ? String((obj as { title: unknown }).title)
    : parts.map(humanize).join(' · ');
  return `${name} · ${leaf}`;
}
