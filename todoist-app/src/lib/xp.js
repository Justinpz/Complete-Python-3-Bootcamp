// XP/level engine for task gamification. Mirrors the LEVELED fitness app's
// curve (mobile/src/xp.js) scaled 1:300, plus task-specific award rules.

export const MAX_LEVEL = 100;
export const LEVEL_BANDS = [
  { maxLevel: 25, perLevel: 100 },
  { maxLevel: 50, perLevel: 150 },
  { maxLevel: 75, perLevel: 200 },
  { maxLevel: 100, perLevel: 300 },
];

function perLevelCost(level) {
  for (const b of LEVEL_BANDS) if (level <= b.maxLevel) return b.perLevel;
  return LEVEL_BANDS[LEVEL_BANDS.length - 1].perLevel;
}

// Total lifetime XP required to reach `level` (level 1 = 0).
export function xpForLevel(level) {
  let t = 0;
  for (let l = 2; l <= level; l++) t += perLevelCost(l);
  return t;
}

export function levelForXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function bandLabel(level) {
  if (level <= 25) return 'Awakening';
  if (level <= 50) return 'Ascending';
  if (level <= 75) return 'Forged';
  return 'Mythic';
}

// amount may be negative (undo); lifetime XP never drops below 0.
export function applyXp(lifetimeXp, amount) {
  const oldLevel = levelForXp(lifetimeXp);
  const next = Math.max(0, lifetimeXp + amount);
  const newLevel = levelForXp(next);
  return { lifetimeXp: next, oldLevel, newLevel, leveledUp: newLevel > oldLevel };
}

export function xpProgress(xp) {
  const level = levelForXp(xp);
  const into = xp - xpForLevel(level);
  if (level >= MAX_LEVEL) return { level, into, needed: 0, pct: 1 };
  const needed = perLevelCost(level + 1);
  return { level, into, needed, pct: into / needed };
}

export function streakMultiplier(days) {
  if (days >= 14) return 1.5;
  if (days >= 7) return 1.25;
  if (days >= 3) return 1.1;
  return 1;
}

export const PRIORITY_BONUS = { 1: 15, 2: 10, 3: 5, 4: 0 };

// day/dueDate are local 'YYYY-MM-DD' keys (string compare is date compare).
export function completionAward({ priority, dueDate = null, day, streakDays }) {
  const onTime = dueDate && day <= dueDate ? 5 : 0;
  return Math.round((10 + PRIORITY_BONUS[priority] + onTime) * streakMultiplier(streakDays));
}

// Called when the daily goal is crossed on `day`. At most one increment per
// calendar day; consecutive days extend the streak, a missed day resets to 1.
// Pure — caller supplies `day` and `yesterday` keys.
export function bumpStreak(streak, day, yesterday) {
  if (streak.lastGoalDay === day) return streak;
  const current = streak.lastGoalDay === yesterday ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastGoalDay: day };
}

// Run on app load: a streak whose last goal day is before yesterday is broken.
export function reconcileStreak(streak, yesterday) {
  if (streak.lastGoalDay && streak.lastGoalDay < yesterday && streak.current !== 0) {
    return { ...streak, current: 0 };
  }
  return streak;
}
