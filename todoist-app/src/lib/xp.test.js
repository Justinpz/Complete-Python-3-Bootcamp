import { describe, it, expect } from 'vitest';
import {
  MAX_LEVEL,
  LEVEL_BANDS,
  xpForLevel,
  levelForXp,
  bandLabel,
  applyXp,
  xpProgress,
  streakMultiplier,
  PRIORITY_BONUS,
  completionAward,
  bumpStreak,
  reconcileStreak,
} from './xp.js';

describe('curve constants', () => {
  it('caps at level 100 with four bands', () => {
    expect(MAX_LEVEL).toBe(100);
    expect(LEVEL_BANDS).toEqual([
      { maxLevel: 25, perLevel: 100 },
      { maxLevel: 50, perLevel: 150 },
      { maxLevel: 75, perLevel: 200 },
      { maxLevel: 100, perLevel: 300 },
    ]);
  });
});

describe('xpForLevel', () => {
  // Expected totals computed explicitly from band costs.
  const cases = [
    [1, 0],
    [2, 100],
    [25, 24 * 100],
    [26, 24 * 100 + 150],
    [50, 24 * 100 + 25 * 150],
    [51, 24 * 100 + 25 * 150 + 200],
    [75, 24 * 100 + 25 * 150 + 25 * 200],
    [76, 24 * 100 + 25 * 150 + 25 * 200 + 300],
    [100, 24 * 100 + 25 * 150 + 25 * 200 + 25 * 300],
  ];
  it.each(cases)('level %i requires %i total XP', (level, total) => {
    expect(xpForLevel(level)).toBe(total);
  });

  it('grand total to 100 is 18650 (LEVELED 5595000 / 300)', () => {
    expect(xpForLevel(100)).toBe(18650);
  });
});

describe('levelForXp', () => {
  it('is consistent with xpForLevel at every band boundary', () => {
    for (const level of [2, 25, 26, 50, 51, 75, 76, 100]) {
      const threshold = xpForLevel(level);
      expect(levelForXp(threshold)).toBe(level);
      expect(levelForXp(threshold - 1)).toBe(level - 1);
    }
  });

  const cases = [
    [0, 1],
    [99, 1],
    [100, 2],
    [250, 3], // mid first band
    [2475, 25], // mid-way between 25 and 26
    [4000, 35], // mid second band: 2400 + 150*10 = 3900 <= 4000 < 4050
    [18650, 100],
    [99999999, 100], // clamped at max
  ];
  it.each(cases)('xp %i -> level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });
});

describe('bandLabel', () => {
  const cases = [
    [1, 'Awakening'],
    [25, 'Awakening'],
    [26, 'Ascending'],
    [50, 'Ascending'],
    [51, 'Forged'],
    [75, 'Forged'],
    [76, 'Mythic'],
    [100, 'Mythic'],
  ];
  it.each(cases)('level %i is %s', (level, label) => {
    expect(bandLabel(level)).toBe(label);
  });
});

describe('applyXp', () => {
  it('reports a single level-up', () => {
    expect(applyXp(99, 1)).toEqual({ lifetimeXp: 100, oldLevel: 1, newLevel: 2, leveledUp: true });
  });

  it('can jump multiple levels at once', () => {
    const r = applyXp(0, 300); // exactly 3 levels in the first band
    expect(r.newLevel).toBe(4);
    expect(r.leveledUp).toBe(true);
  });

  it('no level-up when staying inside a level', () => {
    expect(applyXp(10, 5)).toEqual({ lifetimeXp: 15, oldLevel: 1, newLevel: 1, leveledUp: false });
  });

  it('negative amount de-levels without setting leveledUp', () => {
    expect(applyXp(150, -100)).toEqual({ lifetimeXp: 50, oldLevel: 2, newLevel: 1, leveledUp: false });
  });

  it('floors lifetime XP at 0', () => {
    expect(applyXp(50, -200)).toEqual({ lifetimeXp: 0, oldLevel: 1, newLevel: 1, leveledUp: false });
  });
});

describe('xpProgress', () => {
  it('fresh level start', () => {
    expect(xpProgress(0)).toEqual({ level: 1, into: 0, needed: 100, pct: 0 });
    expect(xpProgress(2400)).toEqual({ level: 25, into: 0, needed: 150, pct: 0 });
  });

  it('mid-level', () => {
    expect(xpProgress(250)).toEqual({ level: 3, into: 50, needed: 100, pct: 0.5 });
  });

  it('MAX_LEVEL pins needed to 0 and pct to 1', () => {
    expect(xpProgress(18650)).toEqual({ level: 100, into: 0, needed: 0, pct: 1 });
    expect(xpProgress(20000)).toEqual({ level: 100, into: 1350, needed: 0, pct: 1 });
  });
});

describe('streakMultiplier', () => {
  const cases = [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1.1],
    [6, 1.1],
    [7, 1.25],
    [13, 1.25],
    [14, 1.5],
    [100, 1.5],
  ];
  it.each(cases)('%i days -> x%d', (days, mult) => {
    expect(streakMultiplier(days)).toBe(mult);
  });
});

describe('completionAward', () => {
  it('exposes the priority bonus table', () => {
    expect(PRIORITY_BONUS).toEqual({ 1: 15, 2: 10, 3: 5, 4: 0 });
  });

  const D = '2026-07-20';
  const EARLY = '2026-07-19';
  const LATE_DUE = '2026-07-10'; // completing on D is late
  // [priority, dueDate, streakDays, expected]
  const cases = [
    // each priority, on-time (multiplier 1): 10 + bonus + 5
    [1, D, 0, 30],
    [2, D, 0, 25],
    [3, D, 0, 20],
    [4, D, 0, 15],
    // completing early still counts as on-time
    [1, '2026-07-21', 0, 30],
    // no due date: no on-time bonus
    [1, null, 0, 25],
    [4, null, 0, 10],
    // late: no on-time bonus
    [1, LATE_DUE, 0, 25],
    [4, LATE_DUE, 0, 10],
    // multiplier tiers on a fixed sum (p1 on-time = 30)
    [1, D, 3, 33],
    [1, D, 7, 38], // 30 * 1.25 = 37.5 -> 38
    [1, D, 14, 45],
    // rounding on odd sums with 1.1
    [2, D, 3, 28], // 25 * 1.1 = 27.5 -> 28
    [4, D, 3, 17], // 15 * 1.1 = 16.5 -> 17
    [3, LATE_DUE, 3, 17], // 15 * 1.1 -> 17
    // rounding on odd sums with 1.25
    [2, D, 7, 31], // 25 * 1.25 = 31.25 -> 31
    [4, D, 7, 19], // 15 * 1.25 = 18.75 -> 19
    [3, D, 13, 25], // 20 * 1.25 = 25
    // 1.5 tier, no due
    [2, null, 14, 30],
    [4, null, 20, 15],
  ];
  it.each(cases)('priority %s due %s streak %i -> %i', (priority, dueDate, streakDays, want) => {
    expect(completionAward({ priority, dueDate, day: D, streakDays })).toBe(want);
  });

  it('dueDate defaults to null (no on-time bonus)', () => {
    expect(completionAward({ priority: 1, day: D, streakDays: 0 })).toBe(25);
  });
});

describe('bumpStreak', () => {
  const DAY = '2026-07-20';
  const YDAY = '2026-07-19';

  it('starts a streak from nothing', () => {
    expect(bumpStreak({ current: 0, best: 0, lastGoalDay: null }, DAY, YDAY)).toEqual({
      current: 1,
      best: 1,
      lastGoalDay: DAY,
    });
  });

  it('extends when last goal day was yesterday', () => {
    expect(bumpStreak({ current: 4, best: 6, lastGoalDay: YDAY }, DAY, YDAY)).toEqual({
      current: 5,
      best: 6,
      lastGoalDay: DAY,
    });
  });

  it('resets to 1 after a missed day, keeping best', () => {
    expect(bumpStreak({ current: 9, best: 9, lastGoalDay: '2026-07-15' }, DAY, YDAY)).toEqual({
      current: 1,
      best: 9,
      lastGoalDay: DAY,
    });
  });

  it('is idempotent within the same day', () => {
    const s = { current: 3, best: 5, lastGoalDay: DAY };
    expect(bumpStreak(s, DAY, YDAY)).toBe(s);
  });

  it('raises best when current passes it', () => {
    expect(bumpStreak({ current: 6, best: 6, lastGoalDay: YDAY }, DAY, YDAY)).toEqual({
      current: 7,
      best: 7,
      lastGoalDay: DAY,
    });
  });
});

describe('reconcileStreak', () => {
  const YDAY = '2026-07-19';

  it('zeroes a broken streak, preserving best and lastGoalDay', () => {
    expect(reconcileStreak({ current: 5, best: 8, lastGoalDay: '2026-07-17' }, YDAY)).toEqual({
      current: 0,
      best: 8,
      lastGoalDay: '2026-07-17',
    });
  });

  it('leaves an intact streak alone (goal hit yesterday)', () => {
    const s = { current: 5, best: 8, lastGoalDay: YDAY };
    expect(reconcileStreak(s, YDAY)).toBe(s);
  });

  it('leaves a streak alone when goal already hit today', () => {
    const s = { current: 5, best: 8, lastGoalDay: '2026-07-20' };
    expect(reconcileStreak(s, YDAY)).toBe(s);
  });

  it('does nothing for a null lastGoalDay', () => {
    const s = { current: 0, best: 0, lastGoalDay: null };
    expect(reconcileStreak(s, YDAY)).toBe(s);
  });
});
