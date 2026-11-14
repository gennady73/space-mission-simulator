import type { EngineConstants, Phase, SideQuestConfig } from '../models/Interfaces';

/**
 * Pure logic for the "Want to know more?" side-quests (spec §8.2, REQ-008):
 * arithmetic only, one hint, the answer checked inline. No DOM, so it is unit-tested.
 */

export function questsForPhase(c: EngineConstants, phase: Phase): SideQuestConfig[] {
  return Object.values(c.side_quests).filter((q) => q.phase === phase);
}

export type CheckResult =
  | { status: 'correct'; value: number }
  | { status: 'wrong'; value: number; direction: 'high' | 'low' }
  | { status: 'invalid' };

/**
 * Reads what a player typed: "6598", "6,598", "6 598.1", "6598 Wh", "5.7375e3".
 * A comma followed by exactly three digits is a thousands separator; any other single comma is a decimal comma ("198,0").
 */
export function parseAnswer(raw: string): number | null {
  let s = raw.trim().replace(/[\s  ]/g, '');
  s = s.replace(/[a-zA-Zµ°%]+$/u, ''); // trailing unit typed by the player
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^[-+]?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function checkAnswer(q: SideQuestConfig, raw: string): CheckResult {
  const value = parseAnswer(raw);
  if (value === null) return { status: 'invalid' };
  if (Math.abs(value - q.correct_value) <= q.tolerance) return { status: 'correct', value };
  return { status: 'wrong', value, direction: value > q.correct_value ? 'high' : 'low' };
}

/** After this many wrong tries the dialog offers to show the worked answer. */
export const TRIES_BEFORE_REVEAL = 3;
