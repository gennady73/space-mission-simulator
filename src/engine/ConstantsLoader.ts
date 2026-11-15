import type { EngineConstants } from '../models/Interfaces';

/**
 * REQ-003: every physical/hardware number comes from public/config/engine-constants.json.
 * REQ-007: the same JSON can be exported, edited and re-imported (validated here).
 */

export const CONSTANTS_URL = './config/engine-constants.json';

const REQUIRED_TOP_LEVEL: Array<keyof EngineConstants> = [
  'schema_version', 'system_constants', 'simulation', 'difficulty_levels', 'team_roles',
  'site_catalog', 'trajectories', 'hardware_catalog', 'graphic_placeholders',
  'side_quests', 'pre_stage_questions', 'shortfall_badges', 'provenance', 'ice_prospecting',
];

const REQUIRED_CATALOGS = [
  'spacecraft_bus', 'launch_vehicles', 'launchpads', 'power_masts', 'energy_storage',
  'comm_systems', 'data_storage', 'cold_trap_logistics', 'utility_links', 'science_instruments',
] as const;

export class ConstantsValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`engine-constants.json failed validation:\n - ${problems.join('\n - ')}`);
  }
}

/** Structural validation. Returns the list of problems (empty = valid). */
export function validateConstants(raw: unknown): string[] {
  const problems: string[] = [];
  if (typeof raw !== 'object' || raw === null) return ['root is not an object'];
  const c = raw as Record<string, unknown>;
  for (const key of REQUIRED_TOP_LEVEL) if (!(key in c)) problems.push(`missing top-level key "${key}"`);
  const hw = c.hardware_catalog as Record<string, unknown> | undefined;
  if (hw) for (const cat of REQUIRED_CATALOGS) {
    const entries = hw[cat] as Record<string, { id?: string }> | undefined;
    if (!entries || Object.keys(entries).length === 0) { problems.push(`hardware_catalog.${cat} is empty`); continue; }
    for (const [key, v] of Object.entries(entries)) if (v.id !== key) problems.push(`hardware_catalog.${cat}.${key}.id must equal its key`);
  }
  const ip = c.ice_prospecting as { default_drill_option?: string; drill_options?: Record<string, { id?: string }> } | undefined;
  if (ip) {
    for (const [key, v] of Object.entries(ip.drill_options ?? {})) if (v.id !== key) problems.push(`ice_prospecting.drill_options.${key}.id must equal its key`);
    if (!ip.default_drill_option || !ip.drill_options?.[ip.default_drill_option]) problems.push('ice_prospecting.default_drill_option must name one of its drill_options');
  }
  const sc = c.system_constants as Record<string, unknown> | undefined;
  if (sc) for (const k of ['minimum_power_margin_pdr', 'minimum_mass_margin_pdr']) {
    const v = sc[k];
    if (typeof v !== 'number' || v < 0 || v > 1) problems.push(`system_constants.${k} must be a fraction 0–1`);
  }
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'number' && !Number.isFinite(v)) problems.push(`${path} is not a finite number`);
    else if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k);
  };
  walk(c, '');
  return problems;
}

export function parseConstants(raw: unknown): EngineConstants {
  const problems = validateConstants(raw);
  if (problems.length) throw new ConstantsValidationError(problems);
  return deepFreeze(raw as EngineConstants);
}

export async function loadConstants(url: string = CONSTANTS_URL): Promise<EngineConstants> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
  return parseConstants(await res.json());
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const v of Object.values(obj as object)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return obj;
}
