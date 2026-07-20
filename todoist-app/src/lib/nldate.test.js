import { describe, it, expect } from 'vitest';
import { parseWhen } from './nldate.js';

// Wed 15 Jul 2026 — all tests pin refDate; never the wall clock.
const REF = new Date(2026, 6, 15);
const T = '2026-07-15';

describe('parseWhen: plain dates via chrono', () => {
  it('parses date + time and cleans the text', () => {
    const r = parseWhen('Buy milk tomorrow 5pm', { refDate: REF });
    expect(r.found).toBe(true);
    expect(r.date).toBe('2026-07-16');
    expect(r.time).toBe('17:00');
    expect(r.recurrence).toBeNull();
    expect(r.cleanedText).toBe('Buy milk');
    expect(r.dueText).toBe('tomorrow 5pm');
    expect(r.spans).toEqual([{ start: 9, end: 21 }]);
  });

  it('honors certain minutes', () => {
    const r = parseWhen('call tomorrow at 5:30pm', { refDate: REF });
    expect(r.date).toBe('2026-07-16');
    expect(r.time).toBe('17:30');
  });

  it('date without a certain hour has time null', () => {
    const r = parseWhen('report friday', { refDate: REF });
    expect(r.date).toBe('2026-07-17');
    expect(r.time).toBeNull();
    expect(r.cleanedText).toBe('report');
  });

  it('forwardDate pushes bare month-day into the future', () => {
    const r = parseWhen('dentist jul 1', { refDate: REF });
    expect(r.date).toBe('2027-07-01');
  });

  it.each([
    ['buy 2 apples'],
    ['do 15 pushups'],
    ['hello world'],
  ])('no false positive for %s', (text) => {
    const r = parseWhen(text, { refDate: REF });
    expect(r.found).toBe(false);
    expect(r.date).toBeNull();
    expect(r.time).toBeNull();
    expect(r.recurrence).toBeNull();
    expect(r.spans).toEqual([]);
    expect(r.cleanedText).toBe(text);
    expect(r.dueText).toBe('');
  });
});

describe('parseWhen: recurrence rules', () => {
  const rule = (freq, over = {}) =>
    ({ freq, interval: 1, byDay: null, byMonthDay: null, fromCompletion: false, ...over });

  it.each([
    ['every day', rule('daily'), T, null],
    ['daily', rule('daily'), T, null],
    ['every morning', rule('daily'), T, '09:00'],
    ['every evening', rule('daily'), T, '19:00'],
    ['every night', rule('daily'), T, '19:00'],
    ['every 2 days', rule('daily', { interval: 2 }), T, null],
    ['every week', rule('weekly'), T, null],
    ['every 3 weeks', rule('weekly', { interval: 3 }), T, null],
    ['every other week', rule('weekly', { interval: 2 }), T, null],
    // Wed 15 Jul: next Monday is the 20th; Wed matches T itself.
    ['every monday', rule('weekly', { byDay: [1] }), '2026-07-20', null],
    ['every wed', rule('weekly', { byDay: [3] }), T, null],
    ['every mon, wed, fri', rule('weekly', { byDay: [1, 3, 5] }), T, null],
    ['every mon and fri', rule('weekly', { byDay: [1, 5] }), '2026-07-17', null],
    ['every weekday', rule('weekly', { byDay: [1, 2, 3, 4, 5] }), T, null],
    ['every weekend', rule('weekly', { byDay: [0, 6] }), '2026-07-18', null],
    ['every month', rule('monthly'), T, null],
    ['every 6 months', rule('monthly', { interval: 6 }), T, null],
    ['every 15th', rule('monthly', { byMonthDay: 15 }), T, null],
    ['every 31st', rule('monthly', { byMonthDay: 31 }), '2026-07-31', null],
    ['every last day', rule('monthly', { byMonthDay: 31 }), '2026-07-31', null],
    ['every year', rule('yearly'), T, null],
    ['yearly', rule('yearly'), T, null],
    ['every! monday', rule('weekly', { byDay: [1], fromCompletion: true }), '2026-07-20', null],
    ['every! 2 days', rule('daily', { interval: 2, fromCompletion: true }), T, null],
  ])('%s', (text, expectedRule, expectedDate, expectedTime) => {
    const r = parseWhen(text, { refDate: REF });
    expect(r.found).toBe(true);
    expect(r.recurrence).toEqual(expectedRule);
    expect(r.date).toBe(expectedDate);
    expect(r.time).toBe(expectedTime);
    expect(r.cleanedText).toBe('');
    expect(r.dueText).toBe(text);
  });

  it('rolls "every 15th" to next month when T is past the 15th', () => {
    const r = parseWhen('every 15th', { refDate: new Date(2026, 6, 20) });
    expect(r.date).toBe('2026-08-15');
    expect(r.recurrence.byMonthDay).toBe(15);
  });

  it('clamps "every 31st" in a 30-day month', () => {
    const r = parseWhen('every 31st', { refDate: new Date(2026, 8, 15) });
    expect(r.date).toBe('2026-09-30');
    expect(r.recurrence.byMonthDay).toBe(31);
  });

  it('explicit time on a recurrence', () => {
    const r = parseWhen('every monday at 9am', { refDate: REF });
    expect(r.recurrence).toEqual(rule('weekly', { byDay: [1] }));
    expect(r.date).toBe('2026-07-20');
    expect(r.time).toBe('09:00');
    expect(r.cleanedText).toBe('');
    expect(r.dueText).toBe('every monday at 9am');
  });

  it('explicit time overrides the "every morning" default', () => {
    const r = parseWhen('every morning at 6am', { refDate: REF });
    expect(r.time).toBe('06:00');
  });

  it('explicit start date replaces the computed first occurrence', () => {
    const r = parseWhen('every 2 weeks starting jul 1', { refDate: REF });
    expect(r.recurrence).toEqual(rule('weekly', { interval: 2 }));
    expect(r.date).toBe('2026-07-01');
    expect(r.cleanedText).toBe('');
    expect(r.dueText).toBe('every 2 weeks starting jul 1');
  });

  it('bare start date after the rule works too', () => {
    const r = parseWhen('gym every 2 weeks jul 1', { refDate: REF });
    expect(r.date).toBe('2026-07-01');
    expect(r.cleanedText).toBe('gym');
  });

  it('"from" start date before the rule', () => {
    const r = parseWhen('pay rent from aug 3 every month', { refDate: REF });
    expect(r.recurrence).toEqual(rule('monthly'));
    expect(r.date).toBe('2026-08-03');
    expect(r.cleanedText).toBe('pay rent');
    expect(r.dueText).toBe('from aug 3 every month');
  });

  it('keeps surrounding text and reports correct spans', () => {
    const text = 'Water plants every 2 days please';
    const r = parseWhen(text, { refDate: REF });
    expect(r.recurrence).toEqual(rule('daily', { interval: 2 }));
    expect(r.spans).toEqual([{ start: 13, end: 25 }]);
    expect(text.slice(13, 25)).toBe('every 2 days');
    expect(r.cleanedText).toBe('Water plants please');
  });
});
