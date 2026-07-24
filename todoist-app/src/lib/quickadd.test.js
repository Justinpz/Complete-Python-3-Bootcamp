import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quickadd.js';

// Wed 15 Jul 2026
const REF = new Date(2026, 6, 15);
const PROJECTS = [
  { id: 'p_work', name: 'Work' },
  { id: 'p_side', name: 'Side Quests' },
];
const LABELS = [
  { id: 'l_err', name: 'errands' },
  { id: 'l_home', name: 'home' },
];
const OPTS = { projects: PROJECTS, labels: LABELS, refDate: REF };

describe('parseQuickAdd', () => {
  it('parses the full kitchen sink line', () => {
    const r = parseQuickAdd('Buy milk tomorrow 5pm p1 @errands #work', OPTS);
    expect(r.title).toBe('Buy milk');
    expect(r.projectId).toBe('p_work');
    expect(r.priority).toBe(1);
    expect(r.labels).toEqual([{ name: 'errands', known: true, id: 'l_err' }]);
    expect(r.due).toEqual({
      date: '2026-07-16',
      time: '17:00',
      recurrence: null,
      anchor: '2026-07-16',
      text: 'tomorrow 5pm',
    });
    expect(r.tokens.map((t) => [t.type, t.text, t.valid])).toEqual([
      ['due', 'tomorrow 5pm', true],
      ['priority', 'p1', true],
      ['label', '@errands', true],
      ['project', '#work', true],
    ]);
  });

  it('matches project names case-insensitively with spaces removed', () => {
    const r = parseQuickAdd('grind #SideQuests', OPTS);
    expect(r.projectId).toBe('p_side');
    expect(r.title).toBe('grind');
  });

  it('keeps an unmatched #token in the title with valid:false', () => {
    const r = parseQuickAdd('ship #nope tomorrow', OPTS);
    expect(r.projectId).toBeNull();
    expect(r.title).toBe('ship #nope');
    expect(r.due.date).toBe('2026-07-16');
    const tok = r.tokens.find((t) => t.type === 'project');
    expect(tok).toMatchObject({ text: '#nope', valid: false });
  });

  it('keeps unknown labels with known:false and strips them from the title', () => {
    const r = parseQuickAdd('water @plants @home', OPTS);
    expect(r.title).toBe('water');
    expect(r.labels).toEqual([
      { name: 'plants', known: false, id: null },
      { name: 'home', known: true, id: 'l_home' },
    ]);
  });

  it('takes the last priority token and strips it mid-word-boundary only', () => {
    const r = parseQuickAdd('pay p2 bill', OPTS);
    expect(r.priority).toBe(2);
    expect(r.title).toBe('pay bill');
    const r2 = parseQuickAdd('p1 escalate p3', OPTS);
    expect(r2.priority).toBe(3);
    expect(r2.title).toBe('escalate');
    // 'p2' embedded in a word is not a priority token
    expect(parseQuickAdd('sup2 crew', OPTS).priority).toBeNull();
  });

  it('parses recurrence with an explicit anchor', () => {
    const r = parseQuickAdd('plan trip every 2 weeks starting jul 1', OPTS);
    expect(r.title).toBe('plan trip');
    expect(r.due.recurrence).toEqual({
      freq: 'weekly',
      interval: 2,
      byDay: null,
      byMonthDay: null,
      fromCompletion: false,
    });
    // past start advances onto the cadence (jul 1 / 15 / 29) at ref jul 15
    expect(r.due.date).toBe('2026-07-15');
    expect(r.due.anchor).toBe('2026-07-15');
    expect(r.due.text).toBe('every 2 weeks starting jul 1');
  });

  it('parses "every 2 days" starting today', () => {
    const r = parseQuickAdd('Water plants every 2 days', OPTS);
    expect(r.title).toBe('Water plants');
    expect(r.due.recurrence).toMatchObject({ freq: 'daily', interval: 2 });
    expect(r.due.date).toBe('2026-07-15');
  });

  it('parses weekday lists', () => {
    const r = parseQuickAdd('standup every mon, wed, fri', OPTS);
    expect(r.due.recurrence).toMatchObject({ freq: 'weekly', byDay: [1, 3, 5] });
    expect(r.due.date).toBe('2026-07-15');
    expect(r.title).toBe('standup');
  });

  it('parses every! as fromCompletion', () => {
    const r = parseQuickAdd('take meds every! monday', OPTS);
    expect(r.due.recurrence).toMatchObject({ byDay: [1], fromCompletion: true });
    expect(r.due.date).toBe('2026-07-20');
  });

  it('rolls "every 15th" forward when today is the 20th', () => {
    const r = parseQuickAdd('rent every 15th', { ...OPTS, refDate: new Date(2026, 6, 20) });
    expect(r.due.recurrence).toMatchObject({ freq: 'monthly', byMonthDay: 15 });
    expect(r.due.date).toBe('2026-08-15');
    expect(r.due.anchor).toBe('2026-08-15');
  });

  it('has no due for bare numbers', () => {
    const r = parseQuickAdd('buy 2 apples', OPTS);
    expect(r.due).toBeNull();
    expect(r.title).toBe('buy 2 apples');
    expect(r.tokens).toEqual([]);
  });

  it('token spans index the original text even after masking', () => {
    const text = 'email @boss p2 tomorrow 9am #work';
    const r = parseQuickAdd(text, OPTS);
    for (const t of r.tokens) {
      expect(text.slice(t.start, t.end)).toBe(t.text);
    }
    expect(r.title).toBe('email');
    expect(r.projectId).toBe('p_work');
    expect(r.priority).toBe(2);
    expect(r.due).toMatchObject({ date: '2026-07-16', time: '09:00' });
    const dueTok = r.tokens.find((t) => t.type === 'due');
    expect(dueTok.text).toBe('tomorrow 9am');
  });

  it('masking prevents tokens from feeding the date parser', () => {
    // '#june' must not be read as the month of June
    const r = parseQuickAdd('review #june goals', OPTS);
    expect(r.due).toBeNull();
    expect(r.title).toBe('review #june goals');
  });

  it('returns empty title when everything is stripped', () => {
    const r = parseQuickAdd('tomorrow p1 @errands', OPTS);
    expect(r.title).toBe('');
    expect(r.due.date).toBe('2026-07-16');
  });
});
