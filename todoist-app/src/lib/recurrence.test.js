import { describe, it, expect } from 'vitest';
import { nextOccurrence, firstOccurrence } from './recurrence.js';

// Fixed dates used throughout: 2026-07-01 is a Wednesday, 2026-07-20 a Monday.
function rule(overrides = {}) {
  return {
    freq: 'daily',
    interval: 1,
    byDay: null,
    byMonthDay: null,
    fromCompletion: false,
    ...overrides,
  };
}

describe('nextOccurrence: daily', () => {
  const cases = [
    // [interval, anchor, after, expected]
    ['basic advance', 1, '2026-07-01', '2026-07-01', '2026-07-02'],
    ['after between occurrences snaps to cadence', 3, '2026-07-01', '2026-07-02', '2026-07-04'],
    ['after ON a cadence date returns the next one', 3, '2026-07-01', '2026-07-04', '2026-07-07'],
    ['after far ahead keeps anchor alignment', 3, '2026-07-01', '2026-07-30', '2026-07-31'],
    ['after before anchor returns anchor', 2, '2026-07-10', '2026-07-01', '2026-07-10'],
    ['crosses month boundary', 1, '2026-07-31', '2026-07-31', '2026-08-01'],
  ];
  it.each(cases)('%s', (_name, interval, anchor, after, expected) => {
    expect(nextOccurrence(rule({ interval }), anchor, after)).toBe(expected);
  });
});

describe('nextOccurrence: weekly without byDay', () => {
  const cases = [
    ['basic advance', 1, '2026-07-01', '2026-07-01', '2026-07-08'],
    ['every 2 weeks completed late keeps alignment', 2, '2026-07-01', '2026-07-20', '2026-07-29'],
    ['after ON a cadence date returns the next one', 2, '2026-07-01', '2026-07-15', '2026-07-29'],
    ['after before anchor returns anchor', 1, '2026-07-08', '2026-07-01', '2026-07-08'],
  ];
  it.each(cases)('%s', (_name, interval, anchor, after, expected) => {
    expect(nextOccurrence(rule({ freq: 'weekly', interval }), anchor, after)).toBe(expected);
  });
});

describe('nextOccurrence: weekly with byDay', () => {
  // anchor 2026-07-01 (Wed); its week runs Sun 2026-06-28 .. Sat 2026-07-04
  const mwf = { freq: 'weekly', byDay: [1, 3, 5] };
  const cases = [
    // interval 1: Mon/Wed/Fri walk within and across weeks
    ['same week later day', 1, '2026-07-01', '2026-07-01', '2026-07-03'],
    ['wraps to next week Monday', 1, '2026-07-01', '2026-07-03', '2026-07-06'],
    ['midweek gap lands on Wednesday', 1, '2026-07-01', '2026-07-07', '2026-07-08'],
    // interval 2: candidate weeks start 06-28, 07-12, 07-26
    ['interval 2 skips the off week', 2, '2026-07-01', '2026-07-03', '2026-07-13'],
    ['interval 2 within an on week', 2, '2026-07-01', '2026-07-13', '2026-07-15'],
    ['interval 2 wraps an on week to the next on week', 2, '2026-07-01', '2026-07-17', '2026-07-27'],
    ['interval 2 after inside an off week', 2, '2026-07-01', '2026-07-08', '2026-07-13'],
  ];
  it.each(cases)('%s', (_name, interval, anchor, after, expected) => {
    expect(nextOccurrence(rule({ ...mwf, interval }), anchor, after)).toBe(expected);
  });

  it('byDay order does not matter', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', interval: 1, byDay: [5, 1, 3] }), '2026-07-01', '2026-07-06')).toBe('2026-07-08');
  });
});

describe('nextOccurrence: monthly without byMonthDay', () => {
  it('clamp sequence Jan 31 -> Feb 28 -> Mar 31 (non-leap, non-compounding)', () => {
    const r = rule({ freq: 'monthly' });
    const feb = nextOccurrence(r, '2026-01-31', '2026-01-31');
    expect(feb).toBe('2026-02-28');
    expect(nextOccurrence(r, '2026-01-31', feb)).toBe('2026-03-31');
  });

  const cases = [
    ['basic advance', 1, '2026-07-15', '2026-07-15', '2026-08-15'],
    ['after ON a cadence date returns the next one', 1, '2026-07-15', '2026-08-15', '2026-09-15'],
    ['interval 3 completed late keeps month alignment', 3, '2026-01-10', '2026-05-01', '2026-07-10'],
    ['after before anchor returns anchor', 1, '2026-07-15', '2026-06-01', '2026-07-15'],
    ['crosses year boundary', 1, '2026-12-15', '2026-12-15', '2027-01-15'],
    ['leap Feb keeps day 29 from a day-29 anchor', 1, '2028-01-29', '2028-01-29', '2028-02-29'],
  ];
  it.each(cases)('%s', (_name, interval, anchor, after, expected) => {
    expect(nextOccurrence(rule({ freq: 'monthly', interval }), anchor, after)).toBe(expected);
  });
});

describe('nextOccurrence: monthly with byMonthDay', () => {
  const cases = [
    ['day N later in the anchor month', 15, 1, '2026-07-01', '2026-07-01', '2026-07-15'],
    ['after ON day N returns next month', 15, 1, '2026-07-01', '2026-07-15', '2026-08-15'],
    ['byMonthDay 31 acts as last day (Feb)', 31, 1, '2026-01-05', '2026-02-01', '2026-02-28'],
    ['byMonthDay 31 acts as last day (Apr)', 31, 1, '2026-01-05', '2026-03-31', '2026-04-30'],
    ['byMonthDay 31 recovers to real 31st', 31, 1, '2026-01-05', '2026-02-28', '2026-03-31'],
    ['interval 2 aligns to anchor month', 15, 2, '2026-01-10', '2026-02-01', '2026-03-15'],
  ];
  it.each(cases)('%s', (_name, byMonthDay, interval, anchor, after, expected) => {
    expect(nextOccurrence(rule({ freq: 'monthly', interval, byMonthDay }), anchor, after)).toBe(expected);
  });
});

describe('nextOccurrence: yearly', () => {
  const cases = [
    ['basic advance', 1, '2026-07-04', '2026-07-04', '2027-07-04'],
    ['after ON a cadence date returns the next one', 1, '2026-07-04', '2027-07-04', '2028-07-04'],
    ['Feb 29 anchor clamps in non-leap year', 1, '2024-02-29', '2024-02-29', '2025-02-28'],
    ['Feb 29 anchor next non-leap (non-compounding)', 1, '2024-02-29', '2025-02-28', '2026-02-28'],
    ['Feb 29 anchor recovers on leap year', 1, '2024-02-29', '2027-02-28', '2028-02-29'],
    ['interval 5 completed years late keeps alignment', 5, '2020-03-01', '2026-01-01', '2030-03-01'],
    ['after before anchor returns anchor', 1, '2026-07-04', '2025-01-01', '2026-07-04'],
  ];
  it.each(cases)('%s', (_name, interval, anchor, after, expected) => {
    expect(nextOccurrence(rule({ freq: 'yearly', interval }), anchor, after)).toBe(expected);
  });
});

describe('firstOccurrence', () => {
  const cases = [
    // [name, rule overrides, fromKey, expected]
    ['daily returns fromKey', { freq: 'daily', interval: 3 }, '2026-07-20', '2026-07-20'],
    ['weekly without byDay returns fromKey', { freq: 'weekly', interval: 2 }, '2026-07-20', '2026-07-20'],
    ['yearly returns fromKey', { freq: 'yearly' }, '2026-07-20', '2026-07-20'],
    ['monthly without byMonthDay returns fromKey', { freq: 'monthly' }, '2026-07-20', '2026-07-20'],
    // 2026-07-20 is a Monday
    ['every monday from a Monday is same day', { freq: 'weekly', byDay: [1] }, '2026-07-20', '2026-07-20'],
    ['every monday from a Tuesday is next Monday', { freq: 'weekly', byDay: [1] }, '2026-07-21', '2026-07-27'],
    ['later byDay in the same week', { freq: 'weekly', byDay: [3, 5] }, '2026-07-21', '2026-07-22'],
    ['week exhausted wraps to next aligned week', { freq: 'weekly', byDay: [1, 3] }, '2026-07-23', '2026-07-27'],
    ['week exhausted with interval 2 skips a week', { freq: 'weekly', interval: 2, byDay: [1] }, '2026-07-21', '2026-08-03'],
    ['byMonthDay later this month', { freq: 'monthly', byMonthDay: 15 }, '2026-07-10', '2026-07-15'],
    ['byMonthDay same-day hit', { freq: 'monthly', byMonthDay: 15 }, '2026-07-15', '2026-07-15'],
    ['byMonthDay passed rolls to next month', { freq: 'monthly', byMonthDay: 15 }, '2026-07-16', '2026-08-15'],
    ['byMonthDay passed respects interval', { freq: 'monthly', interval: 3, byMonthDay: 15 }, '2026-07-16', '2026-10-15'],
    ['byMonthDay 31 clamps to end of Feb', { freq: 'monthly', byMonthDay: 31 }, '2026-02-10', '2026-02-28'],
    ['byMonthDay 31 clamp counts as same-day hit', { freq: 'monthly', byMonthDay: 31 }, '2026-02-28', '2026-02-28'],
  ];
  it.each(cases)('%s', (_name, overrides, fromKey, expected) => {
    expect(firstOccurrence(rule(overrides), fromKey)).toBe(expected);
  });
});
