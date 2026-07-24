import { useMemo } from 'react';
import { useStore } from '../store/store.js';
import { dueOn, overdue } from '../store/selectors.js';
import { todayKey, formatDayHeading } from '../lib/dates.js';
import TaskList from '../components/TaskList.jsx';
import { SectionTitle, SkewButton } from '../components/Panel.jsx';

export default function TodayView() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const today = todayKey();
  const late = useMemo(() => overdue(tasks, today), [tasks, today]);
  const dueToday = useMemo(() => dueOn(tasks, today), [tasks, today]);

  const rescheduleAll = () => {
    for (const t of late) {
      updateTask(t.id, { due: { ...t.due, date: today } });
    }
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>Today</h1>
        <span className="view-sub">{formatDayHeading(today)}</span>
      </header>

      {late.length > 0 && (
        <div className="block block-overdue">
          <SectionTitle
            right={
              <SkewButton kind="ghost" onClick={rescheduleAll}>
                RESCHEDULE ALL → TODAY
              </SkewButton>
            }
          >
            OVERDUE <span className="count">{late.length}</span>
          </SectionTitle>
          <TaskList tasks={late} showProject />
        </div>
      )}

      <div className="block">
        <SectionTitle>
          TODAY <span className="count">{dueToday.length}</span>
        </SectionTitle>
        <TaskList tasks={dueToday} showProject addContext={{ date: today }} />
        {!dueToday.length && !late.length ? (
          <div className="empty-state">
            <div className="empty-title">ALL CLEAR</div>
            <div className="empty-sub">No quests due today. Add one, or raid the Upcoming list.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
