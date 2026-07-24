import { useState } from 'react';
import { useStore } from '../store/store.js';
import { formatChip, formatTime, isOverdue, todayKey } from '../lib/dates.js';
import { subtaskProgress } from '../store/selectors.js';
import { navigate } from '../lib/router.js';
import { CheckIcon, ChevronIcon, RepeatIcon, GripIcon } from './icons.jsx';

function DueChip({ due }) {
  const today = todayKey();
  const cls = isOverdue(due.date, today) ? 'overdue' : due.date === today ? 'today' : 'future';
  return (
    <span className={`chip chip-due chip-due-${cls}`}>
      {formatChip(due.date, today)}
      {due.time ? ` ${formatTime(due.time)}` : ''}
      {due.recurrence ? <RepeatIcon size={11} /> : null}
    </span>
  );
}

export default function TaskItem({ task, depth = 0, showProject = false, dragHandleProps = null, children }) {
  const completeTask = useStore((s) => s.completeTask);
  const pushToast = useStore((s) => s.pushToast);
  const openDetail = useStore((s) => s.openDetail);
  const project = useStore((s) => s.projects[task.projectId]);
  const labels = useStore((s) => s.labels);
  const tasks = useStore((s) => s.tasks);
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const progress = subtaskProgress(tasks, task.id);
  const hasNested = Boolean(children);

  const onComplete = () => {
    if (checking) return;
    setChecking(true);
    setTimeout(() => {
      const res = completeTask(task.id);
      setChecking(false);
      if (res) {
        pushToast({
          kind: 'xp',
          text: `+${res.award} XP`,
          sub: res.nextDate ? `Next: ${formatChip(res.nextDate)}` : task.title,
          undoEntryId: res.entry.id,
        });
      }
    }, 220);
  };

  return (
    <div className="task-block" style={depth ? { '--task-depth': depth } : undefined}>
      <div className={`task-row ${checking ? 'task-checking' : ''}`}>
        {dragHandleProps ? (
          <button type="button" className="task-grip" aria-label="Drag to reorder" {...dragHandleProps}>
            <GripIcon size={14} />
          </button>
        ) : (
          <span className="task-grip task-grip-ghost" />
        )}
        <button
          type="button"
          className={`task-check p${task.priority} ${checking ? 'checked' : ''}`}
          aria-label={`Complete "${task.title}"`}
          onClick={onComplete}
        >
          <CheckIcon size={12} />
        </button>
        <div className="task-main" onClick={() => openDetail(task.id)}>
          <div className="task-title-row">
            {hasNested ? (
              <button
                type="button"
                className="task-caret"
                aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                <ChevronIcon size={12} open={expanded} />
              </button>
            ) : null}
            <span className="task-title">{task.title}</span>
          </div>
          {(task.due || task.labelIds.length || progress || showProject || task.notes) && (
            <div className="task-meta">
              {task.due ? <DueChip due={task.due} /> : null}
              {progress ? (
                <span className="chip chip-progress">
                  {progress.done}/{progress.total}
                </span>
              ) : null}
              {task.labelIds.map((lid) =>
                labels[lid] ? (
                  <button
                    key={lid}
                    type="button"
                    className="chip chip-label"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`label/${lid}`);
                    }}
                  >
                    <span className="dot" style={{ background: labels[lid].color }} />@{labels[lid].name}
                  </button>
                ) : null,
              )}
              {task.notes ? <span className="chip chip-notes">≡</span> : null}
              {showProject && project ? (
                <button
                  type="button"
                  className="chip chip-project"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`project/${project.id}`);
                  }}
                >
                  <span className="dot" style={{ background: project.color }} />
                  {project.name}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {hasNested && expanded ? <div className="task-children">{children}</div> : null}
    </div>
  );
}
