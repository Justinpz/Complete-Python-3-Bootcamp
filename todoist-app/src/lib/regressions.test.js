// Regression tests for review findings in the pure-logic libs.
import { describe, it, expect } from 'vitest';
import { parseWhen } from './nldate.js';
import { parseQuickAdd } from './quickadd.js';
import { nextOccurrence } from './recurrence.js';

const REF = new Date(2026, 6, 20); // Mon 20 Jul 2026

describe('recurrence interval sanitation', () => {
  it("'every 0 days' parses with interval >= 1", () => {
    const r = parseWhen('water plants every 0 days', { refDate: REF });
    expect(r.recurrence.interval).toBe(1);
    expect(r.date).toBe('2026-07-20');
  });

  it('nextOccurrence survives a legacy persisted rule with interval 0', () => {
    const rule = { freq: 'daily', interval: 0, byDay: null, byMonthDay: null, fromCompletion: false };
    expect(nextOccurrence(rule, '2026-07-20', '2026-07-20')).toBe('2026-07-21');
  });

  it('nextOccurrence survives garbage intervals', () => {
    const rule = { freq: 'weekly', interval: NaN, byDay: null, byMonthDay: null, fromCompletion: false };
    expect(nextOccurrence(rule, '2026-07-06', '2026-07-20')).toBe('2026-07-27');
  });
});

describe('recurrence with a past explicit start date', () => {
  it('advances the first occurrence onto the cadence at or after today', () => {
    const r = parseWhen('team sync every 2 weeks starting jul 1', { refDate: REF });
    expect(r.recurrence).toMatchObject({ freq: 'weekly', interval: 2 });
    // cadence jul 1 / 15 / 29 — first occurrence not in the past
    expect(r.date).toBe('2026-07-29');
  });

  it('keeps a future explicit start as-is', () => {
    const r = parseWhen('every 2 weeks starting aug 3', { refDate: REF });
    expect(r.date).toBe('2026-08-03');
  });
});

describe('quickadd label dedupe', () => {
  it('repeated @tokens yield one label entry but both are stripped from the title', () => {
    const r = parseQuickAdd('buy @home stuff @home', { refDate: REF });
    expect(r.labels).toHaveLength(1);
    expect(r.labels[0].name).toBe('home');
    expect(r.title).toBe('buy stuff');
    expect(r.tokens.filter((t) => t.type === 'label')).toHaveLength(2);
  });
});
