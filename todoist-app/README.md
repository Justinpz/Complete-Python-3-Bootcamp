# LEVELED // TASKS

A personal, local-first recreation of [Todoist](https://www.todoist.com) with the
soul of LEVELED: every completed task pays XP, levels climb through the same
Awakening → Ascending → Forged → Mythic bands as the fitness RPG, and daily-goal
streaks multiply your gains.

Everything runs in the browser — no server, no account. State lives in
`localStorage`; use **Stats → Data** to export/import JSON backups.

## Run it

```bash
npm install
npm run dev        # dev server
npm run build      # production build to dist/
npm run preview    # serve the build
```

## Test it

```bash
npm test           # vitest unit tests (dates, recurrence, filters, XP, ordering)
npm run build && npm run e2e   # Playwright smoke: quick-add → complete → XP → recurrence → reload
```

The e2e script expects a Chromium binary (defaults to the Playwright cache at
`/opt/pw-browsers/...`; override with `E2E_CHROMIUM=/path/to/chrome`).

## Features

- **Quick add** (`q`): natural-language parsing inline — `Slay the dragon tomorrow 9am p1 #quests @errands`
- **Recurring tasks**: `every day`, `every 2 weeks`, `every mon, wed, fri`, `every 15th`,
  `every last day`, `every weekday`, `every! 3 days` (from-completion). Completing a
  recurring task reschedules it on its cadence.
- **Views**: Inbox, Today (with overdue triage), Upcoming (14 days), per-project with
  sections, per-label, saved filters, Completed history, Stats.
- **Filters**: Todoist-style query language — `p1 & today`, `(overdue | today) & #work`,
  `!no date & next 7 days`, `@errands`.
- **Subtasks** (3 levels) and **sections**, with drag-to-reorder and drag-across-sections.
- **The grind**: XP per completion (base 10 + priority bonus + on-time bonus, streak
  multipliers ×1.1/×1.25/×1.5), 100 levels, daily-goal ring, 12-week heatmap,
  level-up moments.

## Keyboard

| Key | Action |
| --- | --- |
| `q` | Quick add |
| `t` | Today |
| `u` | Upcoming |
| `1`–`4` | Set priority (in task detail) |
| `Esc` | Close modal |

## Deploying to the LEVELED service

The app ships on the same Render service as the LEVELED fitness app, served by its
Express backend at `/tasks`. That service never builds frontends — it serves whatever
is committed in `LEVELED/backend/public/`, so deploys are build-and-commit:

```bash
# in this folder
npm ci && npm run build:leveled          # vite build --base=/tasks/
rm -rf ../../LEVELED/backend/public/tasks
cp -r dist ../../LEVELED/backend/public/tasks
# commit backend/public/tasks in the LEVELED repo; Render auto-deploys on merge
```

The `/tasks` static mount + SPA fallback live in `LEVELED/backend/src/server.js`.
When re-exporting the LEVELED game's web bundle, follow `backend/DEPLOY.md` — its copy
step is written to preserve `public/tasks/`.

## Architecture

Plain-JS React 19 + Vite. State in one [zustand](https://github.com/pmndrs/zustand)
store (`src/store/store.js`), persisted as a single versioned JSON document.
Pure logic lives in `src/lib/` — `nldate.js` (chrono-node wrapper + recurrence
phrases), `recurrence.js` (cadence engine), `filterQuery.js` (tokenizer →
recursive-descent parser → evaluator), `xp.js` (LEVELED's curve scaled 1:300),
`order.js` (sibling-group integer ranks) — each with colocated tests.
Theme tokens in `src/theme.css` mirror `LEVELED/mobile/src/theme.js`.
