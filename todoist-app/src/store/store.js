import { create } from 'zustand';
import { id } from '../lib/id.js';
import { todayKey, addDays, maxKey } from '../lib/dates.js';
import { groupKeyOf, insertAt, ordersFromArray } from '../lib/order.js';
import { nextOccurrence } from '../lib/recurrence.js';
import { completionAward, applyXp, bumpStreak, reconcileStreak } from '../lib/xp.js';
import { loadState, stateFromDoc, migrate, ENTITY_COLORS, INBOX_ID } from './persistence.js';

// Streaks are recomputed from the per-day history after an undo — the day
// counters are the ground truth, so no prev-streak snapshots are needed.
// `best` is monotonic and kept as-is.
function recomputeStreak(days, goal, today, best) {
  const yesterday = addDays(today, -1);
  const hit = (d) => (days[d]?.completed ?? 0) >= goal;
  const start = hit(today) ? today : hit(yesterday) ? yesterday : null;
  if (!start) return { current: 0, best, lastGoalDay: null };
  let current = 0;
  let d = start;
  while (hit(d)) {
    current += 1;
    d = addDays(d, -1);
  }
  return { current, best: Math.max(best, current), lastGoalDay: start };
}

function descendantsOf(tasks, rootId) {
  const out = [];
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift();
    for (const t of Object.values(tasks)) {
      if (t.parentId === cur) {
        out.push(t.id);
        queue.push(t.id);
      }
    }
  }
  return out;
}

function nextOrderIn(collection, predicate) {
  let max = -1;
  for (const item of Object.values(collection)) {
    if (predicate(item) && item.order > max) max = item.order;
  }
  return max + 1;
}

function pickColor(collection) {
  const used = Object.values(collection).length;
  return ENTITY_COLORS[used % ENTITY_COLORS.length];
}

// Rewrite `order` 0..n-1 for the given task ids (one sibling group, in the
// desired final sequence); returns a new tasks map.
function withOrders(tasks, orderedIds, patch = {}) {
  const orders = ordersFromArray(orderedIds);
  const next = { ...tasks };
  for (const tid of orderedIds) {
    next[tid] = { ...next[tid], ...patch, order: orders[tid] };
  }
  return next;
}

function groupIds(tasks, group, excludeId = null) {
  return Object.values(tasks)
    .filter((t) => !t.completed && t.id !== excludeId && groupKeyOf(t) === groupKeyOf(group))
    .sort((a, b) => a.order - b.order)
    .map((t) => t.id);
}

export const useStore = create((set, get) => ({
  ...loadState(),

  // ---- transient UI (never persisted) ----
  toasts: [],
  levelUp: null,
  detailTaskId: null,
  quickAddOpen: false,
  voiceOpen: false,

  pushToast(toast) {
    const t = { id: id(), ...toast };
    set((s) => ({ toasts: [...s.toasts.slice(-3), t] }));
    return t.id;
  },
  dismissToast(toastId) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toastId) }));
  },
  clearLevelUp() {
    set({ levelUp: null });
  },
  openDetail(taskId) {
    set({ detailTaskId: taskId });
  },
  closeDetail() {
    set({ detailTaskId: null });
  },
  setQuickAddOpen(open) {
    set({ quickAddOpen: open });
  },
  setVoiceOpen(open) {
    set({ voiceOpen: open });
  },

  // ---- tasks ----
  addTask(input) {
    const s = get();
    const task = {
      id: id(),
      title: input.title?.trim() || 'Untitled',
      notes: input.notes || '',
      projectId: input.projectId || INBOX_ID,
      sectionId: input.sectionId ?? null,
      parentId: input.parentId ?? null,
      labelIds: input.labelIds || [],
      priority: input.priority || 4,
      due: input.due ? { anchor: input.due.date, ...input.due } : null,
      order: 0,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    // A section from another project would make the task unreachable in every view
    if (task.sectionId && s.sections[task.sectionId]?.projectId !== task.projectId) {
      task.sectionId = null;
    }
    task.order = nextOrderIn(s.tasks, (t) => !t.completed && groupKeyOf(t) === groupKeyOf(task));
    set({ tasks: { ...s.tasks, [task.id]: task } });
    return task.id;
  },

  updateTask(taskId, patch) {
    const s = get();
    const task = s.tasks[taskId];
    if (!task) return;
    const next = { ...task, ...patch };
    if (next.due && !next.due.anchor) next.due = { ...next.due, anchor: next.due.date };
    set({ tasks: { ...s.tasks, [taskId]: next } });
  },

  deleteTask(taskId) {
    const s = get();
    if (!s.tasks[taskId]) return;
    const doomed = new Set([taskId, ...descendantsOf(s.tasks, taskId)]);
    const tasks = {};
    for (const t of Object.values(s.tasks)) {
      if (!doomed.has(t.id)) tasks[t.id] = t;
    }
    set({ tasks, detailTaskId: doomed.has(s.detailTaskId) ? null : s.detailTaskId });
  },

  // Move to another project/section/parent (append at end of target group).
  // Descendants follow their parent's project/section.
  moveTask(taskId, target, toIndex = null) {
    const s = get();
    const task = s.tasks[taskId];
    if (!task) return;
    const group = {
      projectId: target.projectId ?? task.projectId,
      sectionId: target.sectionId !== undefined ? target.sectionId : task.sectionId,
      parentId: target.parentId !== undefined ? target.parentId : task.parentId,
    };
    if (group.parentId === taskId) return;
    // Subtasks always live in their parent's project/section — a diverging
    // sectionId would split the sibling group into an invisible bucket.
    if (group.parentId) {
      const parent = s.tasks[group.parentId];
      if (parent) {
        group.projectId = parent.projectId;
        group.sectionId = parent.sectionId;
      }
    }
    if (group.sectionId && s.sections[group.sectionId]?.projectId !== group.projectId) {
      group.sectionId = null;
    }
    const ids = groupIds(s.tasks, group, taskId);
    const index = toIndex === null ? ids.length : toIndex;
    let tasks = withOrders(s.tasks, insertAt(ids, taskId, index));
    tasks[taskId] = { ...tasks[taskId], ...group };
    for (const did of descendantsOf(tasks, taskId)) {
      tasks[did] = { ...tasks[did], projectId: group.projectId, sectionId: group.sectionId };
    }
    // reindex the group the task left, if it changed groups
    if (groupKeyOf(task) !== groupKeyOf(tasks[taskId])) {
      tasks = withOrders(tasks, groupIds(tasks, task, taskId));
    }
    set({ tasks });
  },

  reorderTask(taskId, toIndex) {
    const s = get();
    const task = s.tasks[taskId];
    if (!task) return;
    const ids = groupIds(s.tasks, task);
    set({ tasks: withOrders(s.tasks, insertAt(ids, taskId, toIndex)) });
  },

  completeTask(taskId) {
    const s = get();
    const task = s.tasks[taskId];
    if (!task || task.completed) return null;
    const today = todayKey();
    const yesterday = addDays(today, -1);
    const now = new Date().toISOString();
    const award = completionAward({
      priority: task.priority,
      dueDate: task.due?.date ?? null,
      day: today,
      streakDays: s.game.streak.current,
    });
    const applied = applyXp(s.game.xp, award);
    const prevDay = s.game.days[today] || { completed: 0, xp: 0 };
    const day = { completed: prevDay.completed + 1, xp: prevDay.xp + award };
    let streak = s.game.streak;
    if (day.completed >= s.game.dailyGoal) streak = bumpStreak(streak, today, yesterday);

    const recurring = !!task.due?.recurrence;
    const entry = {
      id: id(),
      taskId,
      title: task.title,
      projectId: task.projectId,
      xp: award,
      completedAt: now,
      day: today,
      recurring,
      prevDue: task.due ? { ...task.due } : null,
    };

    let updated;
    const cascade = {};
    if (recurring) {
      const rule = task.due.recurrence;
      // 'every!' re-anchors at the completion day; plain rules stay on their
      // original cadence, skipping past occurrences when completed late.
      const anchor = rule.fromCompletion ? today : task.due.anchor;
      const after = rule.fromCompletion ? today : maxKey(task.due.date, today);
      const nextDate = nextOccurrence(rule, anchor, after);
      updated = { ...task, due: { ...task.due, date: nextDate, anchor } };
    } else {
      updated = { ...task, completed: true, completedAt: now };
      // Active subtasks would otherwise be stranded: still active in the
      // store but unreachable in every view once the parent row disappears.
      // XP is awarded for the parent only; undo restores the whole subtree.
      const stranded = descendantsOf(s.tasks, taskId).filter((did) => !s.tasks[did].completed);
      entry.cascadedTaskIds = stranded;
      for (const did of stranded) {
        cascade[did] = { ...s.tasks[did], completed: true, completedAt: now };
      }
    }

    set({
      tasks: { ...s.tasks, ...cascade, [taskId]: updated },
      completionLog: [...s.completionLog, entry],
      game: { ...s.game, xp: applied.lifetimeXp, streak, days: { ...s.game.days, [today]: day } },
      levelUp: applied.leveledUp ? { level: applied.newLevel } : s.levelUp,
    });
    return { entry, award, ...applied, nextDate: recurring ? updated.due.date : null };
  },

  undoCompletion(entryId) {
    const s = get();
    const entryIndex = s.completionLog.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) return;
    const entry = s.completionLog[entryIndex];
    const applied = applyXp(s.game.xp, -entry.xp);
    const days = { ...s.game.days };
    const stats = days[entry.day];
    if (stats) {
      const upd = {
        completed: Math.max(0, stats.completed - 1),
        xp: Math.max(0, stats.xp - entry.xp),
      };
      if (upd.completed === 0) delete days[entry.day];
      else days[entry.day] = upd;
    }
    const streak = recomputeStreak(days, s.game.dailyGoal, todayKey(), s.game.streak.best);

    const tasks = { ...s.tasks };
    const task = tasks[entry.taskId];
    let completionLog = s.completionLog.filter((e) => e.id !== entryId);
    if (task) {
      if (entry.recurring) {
        // prevDue snapshots form a chain across this task's completions.
        // Undoing an older entry must not rewind the live due date past newer
        // completions — hand its snapshot to the next entry instead, so a
        // full unwind still reaches the original date. Ordering comes from
        // log position (append-only), which is total even when two
        // completions share a timestamp.
        const next = s.completionLog
          .slice(entryIndex + 1)
          .find((e) => e.taskId === entry.taskId && e.recurring);
        if (next) {
          completionLog = completionLog.map((e) =>
            e.id === next.id ? { ...e, prevDue: entry.prevDue } : e,
          );
        } else {
          tasks[entry.taskId] = { ...task, due: entry.prevDue };
        }
      } else {
        tasks[entry.taskId] = { ...task, completed: false, completedAt: null };
        for (const did of entry.cascadedTaskIds || []) {
          if (tasks[did]) tasks[did] = { ...tasks[did], completed: false, completedAt: null };
        }
      }
    }
    set({
      tasks,
      completionLog,
      game: { ...s.game, xp: applied.lifetimeXp, streak, days },
    });
  },

  // ---- projects ----
  addProject(name, color) {
    const s = get();
    const project = {
      id: id(),
      name: name.trim(),
      color: color || pickColor(s.projects),
      order: nextOrderIn(s.projects, () => true),
      collapsed: false,
    };
    set({ projects: { ...s.projects, [project.id]: project } });
    return project.id;
  },

  updateProject(projectId, patch) {
    const s = get();
    const project = s.projects[projectId];
    if (!project) return;
    set({ projects: { ...s.projects, [projectId]: { ...project, ...patch } } });
  },

  deleteProject(projectId) {
    if (projectId === INBOX_ID) return;
    const s = get();
    if (!s.projects[projectId]) return;
    const projects = { ...s.projects };
    delete projects[projectId];
    const sections = {};
    for (const sec of Object.values(s.sections)) {
      if (sec.projectId !== projectId) sections[sec.id] = sec;
    }
    const tasks = {};
    for (const t of Object.values(s.tasks)) {
      if (t.projectId !== projectId) tasks[t.id] = t;
    }
    set({ projects, sections, tasks });
  },

  reorderProject(projectId, toIndex) {
    const s = get();
    const ids = Object.values(s.projects)
      .filter((p) => p.id !== INBOX_ID)
      .sort((a, b) => a.order - b.order)
      .map((p) => p.id);
    const orders = ordersFromArray(insertAt(ids, projectId, toIndex));
    const projects = { ...s.projects };
    for (const [pid, ord] of Object.entries(orders)) {
      projects[pid] = { ...projects[pid], order: ord + 1 }; // inbox stays order 0
    }
    set({ projects });
  },

  // ---- sections ----
  addSection(projectId, name) {
    const s = get();
    const section = {
      id: id(),
      projectId,
      name: name.trim(),
      order: nextOrderIn(s.sections, (x) => x.projectId === projectId),
      collapsed: false,
    };
    set({ sections: { ...s.sections, [section.id]: section } });
    return section.id;
  },

  updateSection(sectionId, patch) {
    const s = get();
    const section = s.sections[sectionId];
    if (!section) return;
    set({ sections: { ...s.sections, [sectionId]: { ...section, ...patch } } });
  },

  // Tasks in a deleted section drop into the project's sectionless area.
  deleteSection(sectionId) {
    const s = get();
    const section = s.sections[sectionId];
    if (!section) return;
    const sections = { ...s.sections };
    delete sections[sectionId];
    let tasks = { ...s.tasks };
    const orphans = Object.values(tasks)
      .filter((t) => t.sectionId === sectionId)
      .sort((a, b) => a.order - b.order);
    if (orphans.length) {
      const target = { projectId: section.projectId, sectionId: null, parentId: null };
      const existing = groupIds(tasks, target);
      const topOrphans = orphans.filter((t) => t.parentId === null).map((t) => t.id);
      tasks = withOrders(tasks, [...existing, ...topOrphans]);
      for (const t of orphans) {
        tasks[t.id] = { ...tasks[t.id], sectionId: null };
      }
    }
    set({ sections, tasks });
  },

  // ---- labels ----
  addLabel(rawName, color) {
    const s = get();
    // Filter-query operators in a name would make '@name' unmatchable
    const name = rawName.trim().replace(/[\s&|()!#@]/g, '').toLowerCase();
    if (!name) return null;
    const existing = Object.values(s.labels).find((l) => l.name === name);
    if (existing) return existing.id;
    const label = {
      id: id(),
      name,
      color: color || pickColor(s.labels),
      order: nextOrderIn(s.labels, () => true),
    };
    set({ labels: { ...s.labels, [label.id]: label } });
    return label.id;
  },

  updateLabel(labelId, patch) {
    const s = get();
    const label = s.labels[labelId];
    if (!label) return;
    const next = { ...label, ...patch };
    if (patch.name) next.name = patch.name.trim().replace(/[\s&|()!#@]/g, '').toLowerCase();
    set({ labels: { ...s.labels, [labelId]: next } });
  },

  deleteLabel(labelId) {
    const s = get();
    if (!s.labels[labelId]) return;
    const labels = { ...s.labels };
    delete labels[labelId];
    const tasks = { ...s.tasks };
    for (const t of Object.values(tasks)) {
      if (t.labelIds.includes(labelId)) {
        tasks[t.id] = { ...t, labelIds: t.labelIds.filter((x) => x !== labelId) };
      }
    }
    set({ labels, tasks });
  },

  // ---- saved filters ----
  addFilter(name, query) {
    const s = get();
    const filter = {
      id: id(),
      name: name.trim(),
      query: query.trim(),
      order: nextOrderIn(s.filters, () => true),
    };
    set({ filters: { ...s.filters, [filter.id]: filter } });
    return filter.id;
  },

  updateFilter(filterId, patch) {
    const s = get();
    const filter = s.filters[filterId];
    if (!filter) return;
    set({ filters: { ...s.filters, [filterId]: { ...filter, ...patch } } });
  },

  deleteFilter(filterId) {
    const s = get();
    const filters = { ...s.filters };
    delete filters[filterId];
    set({ filters });
  },

  // ---- game / settings ----
  setDailyGoal(n) {
    const s = get();
    const dailyGoal = Math.max(1, Math.round(n) || 1);
    const streak = recomputeStreak(s.game.days, dailyGoal, todayKey(), s.game.streak.best);
    set({ game: { ...s.game, dailyGoal, streak } });
  },

  importState(doc) {
    const state = stateFromDoc(migrate(doc));
    // Same guard loadState applies: an old backup's streak must not resurrect.
    state.game.streak = reconcileStreak(state.game.streak, addDays(todayKey(), -1));
    set({ ...state, detailTaskId: null, toasts: [], levelUp: null });
  },

  // Called when the wall-clock day changes while the app stays open, so a
  // streak broken overnight shows as broken without a reload.
  reconcileDay() {
    const s = get();
    const streak = reconcileStreak(s.game.streak, addDays(todayKey(), -1));
    if (streak !== s.game.streak) set({ game: { ...s.game, streak } });
  },
}));
