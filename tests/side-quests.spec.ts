import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConstants } from '../src/engine/ConstantsLoader';
import { checkAnswer, parseAnswer, questsForPhase } from '../src/ui/sideQuestModel';

const c = parseConstants(JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8')));

describe('side-quests (REQ-008)', () => {
  it('every quest belongs to a phase the cockpit shows before launch', () => {
    const phases = Object.values(c.side_quests).map((q) => q.phase);
    expect(phases.every((p) => ['MCR', 'SRR', 'PDR', 'CDR'].includes(p))).toBe(true);
    expect(questsForPhase(c, 'PDR').map((q) => q.id)).toEqual(['quest_battery_sizing', 'quest_pdr_margin', 'quest_data_buffer']);
  });

  it('reads the ways a player types a number', () => {
    expect(parseAnswer('6598')).toBe(6598);
    expect(parseAnswer('6,598')).toBe(6598);
    expect(parseAnswer('6 598.1')).toBe(6598.1);
    expect(parseAnswer('6598 Wh')).toBe(6598);
    expect(parseAnswer('198,0')).toBe(198);
    expect(parseAnswer('5.7375e3')).toBe(5737.5);
    expect(parseAnswer('')).toBeNull();
    expect(parseAnswer('about six thousand')).toBeNull();
  });

  it('accepts answers within tolerance and says which way a wrong one is off', () => {
    const q = c.side_quests.quest_optical_beaming; // 198 W ± 2
    expect(checkAnswer(q, '198').status).toBe('correct');
    expect(checkAnswer(q, '199.5').status).toBe('correct');
    expect(checkAnswer(q, '220')).toEqual({ status: 'wrong', value: 220, direction: 'high' });
    expect(checkAnswer(q, '22')).toEqual({ status: 'wrong', value: 22, direction: 'low' });
    expect(checkAnswer(q, 'W').status).toBe('invalid');
  });

  it('every stored answer passes its own check (no unsolvable quest)', () => {
    for (const q of Object.values(c.side_quests)) expect(checkAnswer(q, String(q.correct_value)).status).toBe('correct');
  });
});
