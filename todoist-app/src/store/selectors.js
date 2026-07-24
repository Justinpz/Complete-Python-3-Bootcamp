// Pure derivation helpers. Components call these inside useMemo keyed on the
// store slices they read — the store itself holds only normalized maps.

import { addDays, todayKey } from '../lib/dates.js';
import { groupKeyOf } from '../lib/order.js';
import { parseFilter, evaluate } from '../lib/filterQuery.js';

export const byOrder = (a, b) => a.order - b.order;

export function activeTasks(tasks) {
  return Object.values(tasks).filter((t) => !t.completed);
}

export function tasksInGroup(tasks, group) {
  const key = groupKeyOf(group);
  return activeTasks(tasks)
    .filter((t) => groupKeyOf(t) === key)
    .sort(byOrder);
}

export function childrenOf(tasks, parentId) {
  return Object.values(tasks)
    .filter((t) => t.parentId === parentId)
    .sort(byOrder);
}

export function activeChildrenOf(tasks, parentId) {
  return childrenOf(tasks, parentId).filter((t) => !t.completed);
}

export function subtaskProgress(tasks, parentId) {
  const kids = childrenOf(tasks, parentId);
  if (!kids.length) return null;
  return { done: kids.filter((t) => t.completed).length, total: kids.length };
}

// Due-date views include subtasks — anything active and dated qualifies.
export function dueOn(tasks, key) {
  return activeTasks(tasks)
    .filter((t) => t.due?.date === key)
    .sort((a, b) => a.priority - b.priority || (a.due.time || '99').localeCompare(b.due.time || '99'));
}

export function overdue(tasks, today = todayKey()) {
  return activeTasks(tasks)
    .filter((t) => t.due && t.due.date < today)
    .sort((a, b) => a.due.date.localeCompare(b.due.date) || a.priority - b.priority);
}

export function todayCount(tasks, today = todayKey()) {
  return activeTasks(tasks).filter((t) => t.due && t.due.date <= today).length;
}

export function sortedProjects(projects) {
  return Object.values(projects).sort(byOrder);
}

export function sectionsOf(sections, projectId) {
  return Object.values(sections)
    .filter((s) => s.projectId === projectId)
    .sort(byOrder);
}

export function sortedLabels(labels) {
  return Object.values(labels).sort(byOrder);
}

export function sortedFilters(filters) {
  return Object.values(filters).sort(byOrder);
}

// Group a flat task list by project, in sidebar project order.
export function groupByProject(list, projectsMap) {
  return sortedProjects(projectsMap)
    .map((project) => ({ project, tasks: list.filter((t) => t.projectId === project.id) }))
    .filter((g) => g.tasks.length > 0);
}

export function tasksWithLabel(tasks, labelId) {
  return activeTasks(tasks)
    .filter((t) => t.labelIds.includes(labelId))
    .sort(byOrder);
}

export function filterCtx(state, today = todayKey()) {
  return {
    today,
    labelNamesOf: (task) =>
      task.labelIds.map((lid) => state.labels[lid]?.name || '').filter(Boolean),
    projectNameOf: (task) =>
      (state.projects[task.projectId]?.name || '').toLowerCase().replace(/\s+/g, ''),
  };
}

export function runFilter(state, query, today = todayKey()) {
  const parsed = parseFilter(query);
  if (!parsed.ok) return { ok: false, error: parsed.error, tasks: [] };
  const ctx = filterCtx(state, today);
  const tasks = activeTasks(state.tasks)
    .filter((t) => evaluate(parsed.ast, t, ctx))
    .sort((a, b) => a.priority - b.priority || (a.due?.date || '9999').localeCompare(b.due?.date || '9999'));
  return { ok: true, tasks };
}

// Completed view: log entries grouped by local day, newest day (and newest
// entry within a day) first.
export function completedGroups(completionLog) {
  const byDay = new Map();
  for (const entry of completionLog) {
    if (!byDay.has(entry.day)) byDay.set(entry.day, []);
    byDay.get(entry.day).push(entry);
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, entries]) => ({
      day,
      entries: entries.slice().sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    }));
}

// 12-week heatmap grid, columns = weeks (oldest first), rows = Sun..Sat.
export function heatmapWeeks(days, weeksCount = 12, today = todayKey()) {
  const end = new Date();
  const endWeekStart = addDays(today, -new Date(end.getFullYear(), end.getMonth(), end.getDate()).getDay());
  const weeks = [];
  for (let w = weeksCount - 1; w >= 0; w -= 1) {
    const weekStart = addDays(endWeekStart, -7 * w);
    const cells = [];
    for (let d = 0; d < 7; d += 1) {
      const key = addDays(weekStart, d);
      cells.push({ key, count: days[key]?.completed ?? 0, future: key > today });
    }
    weeks.push({ weekStart, cells });
  }
  return weeks;
}

export function projectCompletionTotals(completionLog, projects) {
  const totals = new Map();
  for (const entry of completionLog) {
    totals.set(entry.projectId, (totals.get(entry.projectId) || 0) + 1);
  }
  return [...totals.entries()]
    .map(([projectId, count]) => ({
      projectId,
      name: projects[projectId]?.name || 'Deleted project',
      color: projects[projectId]?.color || '#8f9bc0',
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
