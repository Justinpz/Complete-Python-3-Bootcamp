// Regression tests for review findings — exercises the real zustand store.
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store.js';
import { todayKey, addDays } from '../lib/dates.js';

const S = () => useStore.getState();

function reset(extra = {}) {
  S().importState({ schemaVersion: 1, tasks: {}, projects: {}, sections: {}, labels: {}, filters: {}, completionLog: [], ...extra });
}

describe('completeTask cascades to active subtasks (undoable)', () => {
  beforeEach(() => reset());

  it('marks descendants completed, logs their ids, and undo restores the subtree', () => {
    const parentId = S().addTask({ title: 'Parent' });
    const childId = S().addTask({ title: 'Child', parentId });
    const grandId = S().addTask({ title: 'Grandchild', parentId: childId });

    const res = S().completeTask(parentId);
    expect(res.entry.cascadedTaskIds.sort()).toEqual([childId, grandId].sort());
    expect(S().tasks[childId].completed).toBe(true);
    expect(S().tasks[grandId].completed).toBe(true);

    S().undoCompletion(res.entry.id);
    expect(S().tasks[parentId].completed).toBe(false);
    expect(S().tasks[childId].completed).toBe(false);
    expect(S().tasks[grandId].completed).toBe(false);
  });

  it('does not resurrect a subtask the user completed beforehand', () => {
    const parentId = S().addTask({ title: 'Parent' });
    const childId = S().addTask({ title: 'Child', parentId });
    S().completeTask(childId);
    const res = S().completeTask(parentId);
    expect(res.entry.cascadedTaskIds).toEqual([]);
    S().undoCompletion(res.entry.id);
    expect(S().tasks[childId].completed).toBe(true);
  });
});

describe('undoCompletion prevDue chain for recurring tasks', () => {
  beforeEach(() => reset());

  const today = todayKey();

  function addDaily() {
    return S().addTask({
      title: 'Daily quest',
      due: { date: today, time: null, recurrence: { freq: 'daily', interval: 1, byDay: null, byMonthDay: null, fromCompletion: false }, anchor: today, text: 'every day' },
    });
  }

  it('undoing an older completion keeps the live due date and re-chains the snapshot', () => {
    const taskId = addDaily();
    const r1 = S().completeTask(taskId); // due -> today+1
    const r2 = S().completeTask(taskId); // due -> today+2
    expect(S().tasks[taskId].due.date).toBe(addDays(today, 2));

    S().undoCompletion(r1.entry.id);
    expect(S().tasks[taskId].due.date).toBe(addDays(today, 2));
    const remaining = S().completionLog.find((e) => e.id === r2.entry.id);
    expect(remaining.prevDue.date).toBe(today);

    S().undoCompletion(r2.entry.id);
    expect(S().tasks[taskId].due.date).toBe(today);
  });

  it('undoing the latest completion rewinds one step (LIFO unchanged)', () => {
    const taskId = addDaily();
    S().completeTask(taskId);
    const r2 = S().completeTask(taskId);
    S().undoCompletion(r2.entry.id);
    expect(S().tasks[taskId].due.date).toBe(addDays(today, 1));
  });
});

describe('streak invariants', () => {
  it('setDailyGoal keeps best >= current after recompute', () => {
    const today = todayKey();
    const yesterday = addDays(today, -1);
    reset({
      game: {
        xp: 0,
        dailyGoal: 5,
        streak: { current: 0, best: 0, lastGoalDay: null },
        days: { [yesterday]: { completed: 3, xp: 30 }, [today]: { completed: 3, xp: 30 } },
      },
    });
    S().setDailyGoal(3);
    expect(S().game.streak.current).toBe(2);
    expect(S().game.streak.best).toBeGreaterThanOrEqual(2);
  });

  it('importState reconciles a stale streak from an old backup', () => {
    const staleDay = addDays(todayKey(), -5);
    reset({
      game: {
        xp: 0,
        dailyGoal: 1,
        streak: { current: 9, best: 9, lastGoalDay: staleDay },
        days: {},
      },
    });
    expect(S().game.streak.current).toBe(0);
    expect(S().game.streak.best).toBe(9);
  });
});

describe('section/project consistency guards', () => {
  beforeEach(() => reset());

  it('addTask drops a sectionId that belongs to another project', () => {
    const projA = S().addProject('Alpha');
    const projB = S().addProject('Beta');
    const secA = S().addSection(projA, 'Sec A');
    const taskId = S().addTask({ title: 'Orphan bait', projectId: projB, sectionId: secA });
    expect(S().tasks[taskId].sectionId).toBe(null);
  });

  it('moveTask keeps a subtask in its parent section (no phantom move)', () => {
    const proj = S().addProject('P');
    const s1 = S().addSection(proj, 'S1');
    const s2 = S().addSection(proj, 'S2');
    const parentId = S().addTask({ title: 'T', projectId: proj, sectionId: s1 });
    const childId = S().addTask({ title: 'B', projectId: proj, sectionId: s1, parentId });

    S().moveTask(childId, { sectionId: s2, parentId });
    expect(S().tasks[childId].sectionId).toBe(s1);
    expect(S().tasks[childId].parentId).toBe(parentId);
  });
});

describe('label name normalization', () => {
  beforeEach(() => reset());

  it('strips filter-query operator characters so @name stays matchable', () => {
    const lid = S().addLabel('Deep & (Work)!');
    expect(S().labels[lid].name).toBe('deepwork');
  });
});
