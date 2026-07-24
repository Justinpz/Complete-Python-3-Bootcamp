// Recurrence engine: computes occurrences of a Rule (see types.js) purely
// with day-key arithmetic — no day-by-day scanning across months/years.

import { parts, clampedKey, addDays, diffDays, weekdayOf } from './dates.js';

// (b - a) in whole calendar months, ignoring day-of-month
function monthsBetween(aKey, bKey) {
  const a = parts(aKey);
  const b = parts(bKey);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

function sortedByDay(byDay) {
  return [...byDay].sort((a, b) => a - b);
}

// Rules from old backups or hand-edited storage may carry interval 0 or
// garbage; a non-positive step would loop forever or produce NaN dates.
function safeInterval(rule) {
  const n = Math.round(Number(rule.interval));
  return n >= 1 ? n : 1;
}

// First date strictly after afterKey on the rule's cadence anchored at anchorKey.
export function nextOccurrence(rule, anchorKey, afterKey) {
  const interval = safeInterval(rule);

  if (rule.freq === 'daily' || (rule.freq === 'weekly' && !(rule.byDay && rule.byDay.length))) {
    const step = rule.freq === 'daily' ? interval : 7 * interval;
    const delta = diffDays(anchorKey, afterKey);
    // minimal k >= 0 with k*step > delta
    const k = delta < 0 ? 0 : Math.floor(delta / step) + 1;
    return addDays(anchorKey, k * step);
  }

  if (rule.freq === 'weekly') {
    const days = sortedByDay(rule.byDay);
    const anchorWeekStart = addDays(anchorKey, -weekdayOf(anchorKey));
    const afterWeekStart = addDays(afterKey, -weekdayOf(afterKey));
    const weeks = Math.floor(diffDays(anchorWeekStart, afterWeekStart) / 7);
    let k = Math.max(0, Math.floor(weeks / interval));
    for (;;) {
      const weekStart = addDays(anchorWeekStart, 7 * interval * k);
      for (const wd of days) {
        const cand = addDays(weekStart, wd);
        if (cand > afterKey) return cand;
      }
      k += 1;
    }
  }

  if (rule.freq === 'monthly') {
    const a = parts(anchorKey);
    // clamp is per-occurrence from the original day, so it never compounds
    const day = rule.byMonthDay != null ? rule.byMonthDay : a.d;
    let k = Math.max(0, Math.floor(monthsBetween(anchorKey, afterKey) / interval));
    for (;;) {
      const cand = clampedKey(a.y, a.m + interval * k, day);
      if (cand > afterKey) return cand;
      k += 1;
    }
  }

  // yearly
  const a = parts(anchorKey);
  const yearsDelta = parts(afterKey).y - a.y;
  let k = Math.max(0, Math.floor(yearsDelta / interval));
  for (;;) {
    const cand = clampedKey(a.y + interval * k, a.m, a.d);
    if (cand > afterKey) return cand;
    k += 1;
  }
}

// First cadence date >= fromKey when the rule is anchored AT fromKey.
// Used when creating a task from a phrase like 'every monday'.
export function firstOccurrence(rule, fromKey) {
  const interval = safeInterval(rule);
  if (rule.freq === 'weekly' && rule.byDay && rule.byDay.length) {
    const days = sortedByDay(rule.byDay);
    const wd = weekdayOf(fromKey);
    const hit = days.find((d) => d >= wd);
    if (hit !== undefined) return addDays(fromKey, hit - wd);
    // no byDay left this week: earliest byDay in the next aligned week
    return addDays(fromKey, -wd + 7 * interval + days[0]);
  }
  if (rule.freq === 'monthly' && rule.byMonthDay != null) {
    const { y, m } = parts(fromKey);
    const cand = clampedKey(y, m, rule.byMonthDay);
    return cand >= fromKey ? cand : clampedKey(y, m + interval, rule.byMonthDay);
  }
  return fromKey;
}
