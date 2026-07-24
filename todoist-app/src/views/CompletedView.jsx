import { useMemo } from 'react';
import { useStore } from '../store/store.js';
import { completedGroups } from '../store/selectors.js';
import { formatDayHeading } from '../lib/dates.js';
import { SectionTitle } from '../components/Panel.jsx';
import { CheckIcon } from '../components/icons.jsx';

function EntryRow({ entry }) {
  const undoCompletion = useStore((s) => s.undoCompletion);
  const project = useStore((s) => s.projects[entry.projectId]);
  const time = new Date(entry.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="completed-row">
      <span className="completed-check">
        <CheckIcon size={12} />
      </span>
      <span className="completed-title">{entry.title}</span>
      {entry.recurring ? <span className="chip chip-progress">↻</span> : null}
      <span className="chip chip-xp">+{entry.xp} XP</span>
      <span className="chip chip-project">
        <span className="dot" style={{ background: project?.color || '#8f9bc0' }} />
        {project?.name || 'Deleted project'}
      </span>
      <span className="completed-time">{time}</span>
      <button type="button" className="mini-btn" onClick={() => undoCompletion(entry.id)}>
        Undo
      </button>
    </div>
  );
}

export default function CompletedView() {
  const completionLog = useStore((s) => s.completionLog);
  const groups = useMemo(() => completedGroups(completionLog), [completionLog]);

  return (
    <div className="view">
      <header className="view-head">
        <h1>Completed</h1>
        <span className="view-sub">{completionLog.length} conquered</span>
      </header>
      {groups.map((g) => (
        <div className="block" key={g.day}>
          <SectionTitle>
            {formatDayHeading(g.day).toUpperCase()}{' '}
            <span className="count">{g.entries.length}</span>
          </SectionTitle>
          {g.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      ))}
      {!groups.length && (
        <div className="empty-state">
          <div className="empty-title">NO VICTORIES YET</div>
          <div className="empty-sub">Complete a task and it will be chronicled here.</div>
        </div>
      )}
    </div>
  );
}
