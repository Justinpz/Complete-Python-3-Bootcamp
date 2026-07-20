import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/store.js';
import { childrenOf, sortedProjects, sortedLabels, sectionsOf } from '../store/selectors.js';
import { formatChip } from '../lib/dates.js';
import DatePicker from './DatePicker.jsx';
import { SkewButton, IconButton } from './Panel.jsx';
import { CheckIcon, TrashIcon, XIcon, PlusIcon } from './icons.jsx';

function depthOf(tasks, task) {
  let depth = 0;
  let cur = task;
  while (cur.parentId && tasks[cur.parentId]) {
    depth += 1;
    cur = tasks[cur.parentId];
  }
  return depth;
}

function SubtaskRow({ sub }) {
  const completeTask = useStore((s) => s.completeTask);
  const pushToast = useStore((s) => s.pushToast);
  const deleteTask = useStore((s) => s.deleteTask);
  const openDetail = useStore((s) => s.openDetail);

  const onToggle = () => {
    if (sub.completed) return;
    const res = completeTask(sub.id);
    if (res) {
      pushToast({ kind: 'xp', text: `+${res.award} XP`, sub: sub.title, undoEntryId: res.entry.id });
    }
  };

  return (
    <div className={`detail-subtask ${sub.completed ? 'done' : ''}`}>
      <button
        type="button"
        className={`task-check p${sub.priority} ${sub.completed ? 'checked' : ''}`}
        onClick={onToggle}
        aria-label={`Complete "${sub.title}"`}
        disabled={sub.completed}
      >
        <CheckIcon size={12} />
      </button>
      <button type="button" className="detail-subtask-title" onClick={() => openDetail(sub.id)}>
        {sub.title}
      </button>
      {sub.due ? <span className="chip chip-due chip-due-future">{formatChip(sub.due.date)}</span> : null}
      <IconButton label="Delete subtask" onClick={() => deleteTask(sub.id)}>
        <TrashIcon size={13} />
      </IconButton>
    </div>
  );
}

export default function TaskDetail() {
  const taskId = useStore((s) => s.detailTaskId);
  const task = useStore((s) => (s.detailTaskId ? s.tasks[s.detailTaskId] : null));
  if (!taskId || !task) return null;
  return <TaskDetailModal key={taskId} task={task} />;
}

function TaskDetailModal({ task }) {
  const closeDetail = useStore((s) => s.closeDetail);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const moveTask = useStore((s) => s.moveTask);
  const addTask = useStore((s) => s.addTask);
  const addLabel = useStore((s) => s.addLabel);
  const tasks = useStore((s) => s.tasks);
  const projectsMap = useStore((s) => s.projects);
  const sectionsMap = useStore((s) => s.sections);
  const labelsMap = useStore((s) => s.labels);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [newSub, setNewSub] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const projects = useMemo(() => sortedProjects(projectsMap), [projectsMap]);
  const sections = useMemo(() => sectionsOf(sectionsMap, task.projectId), [sectionsMap, task.projectId]);
  const labels = useMemo(() => sortedLabels(labelsMap), [labelsMap]);
  const subtasks = useMemo(() => childrenOf(tasks, task.id), [tasks, task.id]);
  const depth = depthOf(tasks, task);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeDetail();
        return;
      }
      const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      if (!inField && /^[1-4]$/.test(e.key)) {
        updateTask(task.id, { priority: Number(e.key) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task.id, closeDetail, updateTask]);

  const commitTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) updateTask(task.id, { title: t });
    else setTitle(task.title);
  };

  const toggleLabel = (labelId) => {
    const has = task.labelIds.includes(labelId);
    updateTask(task.id, {
      labelIds: has ? task.labelIds.filter((x) => x !== labelId) : [...task.labelIds, labelId],
    });
  };

  const addSubtask = () => {
    const t = newSub.trim();
    if (!t) return;
    addTask({ title: t, projectId: task.projectId, sectionId: task.sectionId, parentId: task.id });
    setNewSub('');
  };

  const createLabel = () => {
    const name = newLabel.trim();
    if (!name) return;
    const lid = addLabel(name);
    if (lid && !task.labelIds.includes(lid)) toggleLabel(lid);
    setNewLabel('');
  };

  return (
    <div className="modal-scrim" onMouseDown={closeDetail} role="presentation">
      <div className="detail panel" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Task details">
        <div className="detail-head">
          <input
            className="detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label="Task title"
          />
          <IconButton label="Close" onClick={closeDetail}>
            <XIcon size={16} />
          </IconButton>
        </div>

        <textarea
          className="detail-notes"
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== task.notes) updateTask(task.id, { notes });
          }}
          rows={2}
        />

        <div className="detail-grid">
          <div className="detail-field">
            <div className="detail-label">PRIORITY</div>
            <div className="priority-picker" role="radiogroup" aria-label="Priority">
              {[1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`priority-opt pr${p} ${task.priority === p ? 'active' : ''}`}
                  onClick={() => updateTask(task.id, { priority: p })}
                >
                  P{p}
                </button>
              ))}
            </div>
          </div>

          <div className="detail-field">
            <div className="detail-label">PROJECT</div>
            <div className="detail-move">
              <select
                className="select"
                value={task.projectId}
                aria-label="Project"
                onChange={(e) => moveTask(task.id, { projectId: e.target.value, sectionId: null, parentId: null })}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {sections.length > 0 && (
                <select
                  className="select"
                  value={task.sectionId ?? ''}
                  aria-label="Section"
                  onChange={(e) => moveTask(task.id, { sectionId: e.target.value || null, parentId: task.parentId })}
                >
                  <option value="">No section</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="detail-field detail-field-wide">
            <div className="detail-label">DUE</div>
            <DatePicker due={task.due} onChange={(due) => updateTask(task.id, { due })} />
          </div>

          <div className="detail-field detail-field-wide">
            <div className="detail-label">LABELS</div>
            <div className="detail-labels">
              {labels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`chip chip-label ${task.labelIds.includes(l.id) ? 'chip-label-on' : ''}`}
                  onClick={() => toggleLabel(l.id)}
                >
                  <span className="dot" style={{ background: l.color }} />@{l.name}
                </button>
              ))}
              <input
                className="text-input text-input-mini"
                placeholder="+ new label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createLabel();
                  }
                }}
              />
            </div>
          </div>

          {depth < 3 && (
            <div className="detail-field detail-field-wide">
              <div className="detail-label">SUBTASKS</div>
              <div className="detail-subtasks">
                {subtasks.map((sub) => (
                  <SubtaskRow key={sub.id} sub={sub} />
                ))}
                <div className="detail-subtask-add">
                  <PlusIcon size={13} />
                  <input
                    className="text-input text-input-mini"
                    placeholder="Add subtask…"
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="detail-foot">
          <span className="detail-created">Created {new Date(task.createdAt).toLocaleDateString()}</span>
          <SkewButton
            kind="danger"
            onClick={() => {
              if (window.confirm(`Delete "${task.title}"${subtasks.length ? ' and its subtasks' : ''}?`)) {
                deleteTask(task.id);
              }
            }}
          >
            DELETE
          </SkewButton>
        </div>
      </div>
    </div>
  );
}
