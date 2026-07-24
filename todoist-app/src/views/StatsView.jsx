import { useMemo, useRef } from 'react';
import { useStore } from '../store/store.js';
import { heatmapWeeks, projectCompletionTotals } from '../store/selectors.js';
import { xpProgress, bandLabel } from '../lib/xp.js';
import { todayKey } from '../lib/dates.js';
import { exportBackup, readBackupFile } from '../store/exportImport.js';
import XPBar from '../components/XPBar.jsx';
import { Panel, SectionTitle, SkewButton } from '../components/Panel.jsx';
import { DownloadIcon, UploadIcon } from '../components/icons.jsx';

function GoalRing({ done, goal }) {
  const pct = Math.min(1, goal ? done / goal : 0);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="goal-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} className="goal-ring-track" />
        <circle
          cx="42"
          cy="42"
          r={r}
          className="goal-ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div className="goal-ring-label">
        <span className="goal-ring-count">
          {done}/{goal}
        </span>
        <span className="goal-ring-sub">TODAY</span>
      </div>
    </div>
  );
}

function Heatmap({ days }) {
  const weeks = useMemo(() => heatmapWeeks(days), [days]);
  const max = Math.max(1, ...weeks.flatMap((w) => w.cells.map((cell) => cell.count)));
  return (
    <div className="heatmap" title="Completions, last 12 weeks">
      {weeks.map((week) => (
        <div className="heatmap-col" key={week.weekStart}>
          {week.cells.map((cell) => (
            <div
              key={cell.key}
              className={`heatmap-cell ${cell.future ? 'future' : ''}`}
              style={cell.count ? { '--heat': Math.min(1, 0.25 + (0.75 * cell.count) / max) } : undefined}
              title={`${cell.key}: ${cell.count}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function StatsView() {
  const game = useStore((s) => s.game);
  const completionLog = useStore((s) => s.completionLog);
  const projects = useStore((s) => s.projects);
  const setDailyGoal = useStore((s) => s.setDailyGoal);
  const importState = useStore((s) => s.importState);
  const pushToast = useStore((s) => s.pushToast);
  const fileRef = useRef(null);

  const p = xpProgress(game.xp);
  const today = todayKey();
  const todayStats = game.days[today] || { completed: 0, xp: 0 };
  const totals = useMemo(() => projectCompletionTotals(completionLog, projects), [completionLog, projects]);

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const doc = await readBackupFile(file);
      const counts = `${Object.keys(doc.tasks).length} tasks, ${Object.keys(doc.projects).length} projects`;
      if (window.confirm(`Replace ALL current data with this backup (${counts})? This cannot be undone.`)) {
        importState(doc);
        pushToast({ kind: 'info', text: 'Backup restored.' });
      }
    } catch (err) {
      pushToast({ kind: 'error', text: `Import failed: ${err.message}` });
    }
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>Stats</h1>
        <span className="view-sub">The chronicle of your grind</span>
      </header>

      <div className="stats-grid">
        <Panel className="stats-hero">
          <div className="stats-hero-level">
            <div className="stats-hero-number">{p.level}</div>
            <div className="stats-hero-band">{bandLabel(p.level).toUpperCase()}</div>
          </div>
          <div className="stats-hero-bar">
            <XPBar xp={game.xp} />
            <div className="stats-hero-total">{game.xp.toLocaleString()} lifetime XP</div>
          </div>
        </Panel>

        <Panel accent="#35e0ff" className="stats-streak">
          <SectionTitle>STREAK</SectionTitle>
          <div className="stats-streak-row">
            <div className="stats-streak-flame">
              🔥 <span className="stats-streak-count">{game.streak.current}</span>
              <span className="stats-streak-unit">days</span>
            </div>
            <GoalRing done={todayStats.completed} goal={game.dailyGoal} />
          </div>
          <div className="stats-streak-foot">
            <span>Best: {game.streak.best}</span>
            <label className="goal-setter">
              Daily goal
              <input
                type="number"
                min="1"
                max="99"
                value={game.dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
              />
            </label>
          </div>
        </Panel>

        <Panel className="stats-heat">
          <SectionTitle>ACTIVITY ‧ 12 WEEKS</SectionTitle>
          <Heatmap days={game.days} />
        </Panel>

        <Panel className="stats-projects">
          <SectionTitle>CONQUESTS BY PROJECT</SectionTitle>
          {totals.length ? (
            totals.map((t) => (
              <div className="stats-project-row" key={t.projectId}>
                <span className="dot" style={{ background: t.color }} />
                <span className="stats-project-name">{t.name}</span>
                <span className="stats-project-count">{t.count}</span>
              </div>
            ))
          ) : (
            <div className="empty-sub">No completions yet.</div>
          )}
        </Panel>

        <Panel className="stats-data">
          <SectionTitle>DATA</SectionTitle>
          <p className="stats-data-note">
            Everything lives in this browser. Export a JSON backup regularly — restoring one replaces all
            current data.
          </p>
          <div className="stats-data-actions">
            <SkewButton kind="ghost" onClick={() => exportBackup(useStore.getState())}>
              <DownloadIcon size={14} /> EXPORT BACKUP
            </SkewButton>
            <SkewButton kind="ghost" onClick={() => fileRef.current?.click()}>
              <UploadIcon size={14} /> IMPORT
            </SkewButton>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportFile} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
