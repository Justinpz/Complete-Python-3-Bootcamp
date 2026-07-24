// JSDoc typedefs — the data-model contract for the whole app.
// Plain-JS project; these exist for editor IntelliSense and as documentation.

/**
 * Recurrence rule. Built by nldate.js from phrases like "every 2 weeks",
 * consumed by recurrence.js nextOccurrence().
 * @typedef {Object} Rule
 * @property {'daily'|'weekly'|'monthly'|'yearly'} freq
 * @property {number} interval - every N units, >= 1
 * @property {number[]|null} byDay - weekdays 0=Sun..6=Sat, weekly only ("every mon, wed")
 * @property {number|null} byMonthDay - day of month, monthly only ("every 15th");
 *   values past a month's end clamp to its last day, so 31 means "every last day"
 * @property {boolean} fromCompletion - "every!" — cadence advances from completion day
 */

/**
 * @typedef {Object} Due
 * @property {string} date - 'YYYY-MM-DD' local day key
 * @property {string|null} time - 'HH:mm' 24h, or null for all-day
 * @property {Rule|null} recurrence
 * @property {string} anchor - first scheduled date; fixes cadence for interval > 1
 * @property {string} text - original phrase ("every 2 weeks"), for display/re-edit
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} notes
 * @property {string} projectId - 'inbox' is a fixed, undeletable project
 * @property {string|null} sectionId - null = the project's sectionless area
 * @property {string|null} parentId - subtask nesting, max depth 3
 * @property {string[]} labelIds
 * @property {1|2|3|4} priority - 1 = P1 highest (Todoist convention)
 * @property {Due|null} due
 * @property {number} order - integer rank within the sibling group
 *   (projectId, sectionId, parentId); see lib/order.js
 * @property {boolean} completed
 * @property {string|null} completedAt - ISO timestamp
 * @property {string} createdAt - ISO timestamp
 */

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} color - hex, from the LEVELED accent set
 * @property {number} order
 * @property {boolean} collapsed - collapsed in the sidebar
 */

/**
 * @typedef {Object} Section
 * @property {string} id
 * @property {string} projectId
 * @property {string} name
 * @property {number} order
 * @property {boolean} collapsed
 */

/**
 * @typedef {Object} Label
 * @property {string} id
 * @property {string} name - lowercase, no spaces
 * @property {string} color - hex
 * @property {number} order
 */

/**
 * @typedef {Object} Filter
 * @property {string} id
 * @property {string} name
 * @property {string} query - raw filter string, parsed live by lib/filterQuery.js
 * @property {number} order
 */

/**
 * Append-only completion log entry — the single source for the Completed view
 * and all XP accounting. Snapshots survive later task edits/deletes; undo
 * reverses exactly using the stored xp and prevDue.
 * @typedef {Object} CompletionEntry
 * @property {string} id
 * @property {string} taskId
 * @property {string} title - snapshot
 * @property {string} projectId - snapshot
 * @property {number} xp - exact XP awarded
 * @property {string} completedAt - ISO timestamp
 * @property {string} day - 'YYYY-MM-DD' local day bucket
 * @property {boolean} recurring
 * @property {Due|null} prevDue - due before this completion (for undo of recurring)
 */

/**
 * @typedef {Object} GameState
 * @property {number} xp - lifetime XP; level is always derived, never stored
 * @property {number} dailyGoal - completions per day to keep the streak
 * @property {{current: number, best: number, lastGoalDay: string|null}} streak
 * @property {Object<string, {completed: number, xp: number}>} days - stats/heatmap source
 */

export {};
