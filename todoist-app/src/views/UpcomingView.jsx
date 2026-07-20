import { useMemo } from 'react';
import { useStore } from '../store/store.js';
import { dueOn, overdue } from '../store/selectors.js';
import { addDays, formatDayHeading, todayKey } from '../lib/dates.js';
import TaskList from '../components/TaskList.jsx';
import { SectionTitle } from '../components/Panel.jsx';

const DAYS_AHEAD = 14;

export default function UpcomingView() {
  const tasks = useStore((s) => s.tasks);
  const today = todayKey();
  const late = useMemo(() => overdue(tasks, today), [tasks, today]);
  const days = useMemo(
    () =>
      Array.from({ length: DAYS_AHEAD }, (_, i) => {
        const key = addDays(today, i);
        return { key, tasks: dueOn(tasks, key) };
      }),
    [tasks, today],
  );

  return (
    <div className="view">
      <header className="view-head">
        <h1>Upcoming</h1>
        <span className="view-sub">Next {DAYS_AHEAD} days</span>
      </header>

      {late.length > 0 && (
        <div className="block block-overdue">
          <SectionTitle>
            OVERDUE <span className="count">{late.length}</span>
          </SectionTitle>
          <TaskList tasks={late} showProject />
        </div>
      )}

      {days.map((day) => (
        <div className="block block-day" key={day.key}>
          <SectionTitle>{formatDayHeading(day.key, today).toUpperCase()}</SectionTitle>
          <TaskList tasks={day.tasks} showProject addContext={{ date: day.key }} />
        </div>
      ))}
    </div>
  );
}
