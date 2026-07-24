// localStorage persistence: one JSON document, synchronous load before first
// render (no hydration flash), debounced saves flushed on unload/hide.

import { todayKey, addDays } from '../lib/dates.js';
import { reconcileStreak } from '../lib/xp.js';

export const STORAGE_KEY = 'todoist-app:v1';
export const SCHEMA_VERSION = 1;

// LEVELED body-part accents, reused as the project/label color choices.
export const ENTITY_COLORS = ['#ff7a45', '#3ddc84', '#ffc93c', '#4f8dff', '#c964ff', '#ff5fa2'];

export const INBOX_ID = 'inbox';

export function defaultState() {
  return {
    tasks: {},
    projects: {
      [INBOX_ID]: { id: INBOX_ID, name: 'Inbox', color: '#8f9bc0', order: 0, collapsed: false },
    },
    sections: {},
    labels: {},
    filters: {},
    completionLog: [],
    game: {
      xp: 0,
      dailyGoal: 5,
      streak: { current: 0, best: 0, lastGoalDay: null },
      days: {},
    },
  };
}

// schemaVersion switch — v1 is current; future migrations stack here and
// each returns a doc of the next version.
export function migrate(doc) {
  return doc;
}

const PERSISTED_KEYS = ['tasks', 'projects', 'sections', 'labels', 'filters', 'completionLog', 'game'];

export function serialize(state) {
  const doc = { schemaVersion: SCHEMA_VERSION };
  for (const key of PERSISTED_KEYS) doc[key] = state[key];
  return doc;
}

// Merge a (possibly partial or foreign) doc onto defaults, guaranteeing the
// invariants the rest of the app assumes: Inbox exists, game shape is whole.
export function stateFromDoc(doc) {
  const base = defaultState();
  if (!doc || typeof doc !== 'object') return base;
  const state = { ...base };
  for (const key of PERSISTED_KEYS) {
    if (doc[key] && typeof doc[key] === 'object') state[key] = doc[key];
  }
  if (!Array.isArray(state.completionLog)) state.completionLog = [];
  state.projects = { ...state.projects };
  if (!state.projects[INBOX_ID]) state.projects[INBOX_ID] = base.projects[INBOX_ID];
  state.game = {
    ...base.game,
    ...state.game,
    streak: { ...base.game.streak, ...(state.game?.streak || {}) },
    days: { ...(state.game?.days || {}) },
  };
  return state;
}

export function loadState(storage) {
  // window guard keeps the store importable under vitest's node environment
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  let doc = null;
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (raw) doc = migrate(JSON.parse(raw));
  } catch {
    doc = null;
  }
  const state = stateFromDoc(doc);
  state.game.streak = reconcileStreak(state.game.streak, addDays(todayKey(), -1));
  return state;
}

let saveTimer = null;
let saveFailed = false;

export function initPersistence(store, storage) {
  const backing = storage || window.localStorage;
  const save = () => {
    try {
      backing.setItem(STORAGE_KEY, JSON.stringify(serialize(store.getState())));
      saveFailed = false;
    } catch (err) {
      console.error('Persisting state failed', err);
      // Toast once per failure streak: the toast itself changes state, which
      // schedules another save — repeating the toast would loop forever.
      if (!saveFailed) {
        saveFailed = true;
        store.getState().pushToast({ kind: 'error', text: 'Saving failed — is storage full?' });
      }
    }
  };
  const debounced = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  };
  const flush = () => {
    clearTimeout(saveTimer);
    save();
  };
  const unsub = store.subscribe(debounced);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  return { flush, unsub };
}
