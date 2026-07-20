import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store.js';
import { parseQuickAdd } from '../lib/quickadd.js';
import { formatChip, formatTime } from '../lib/dates.js';
import { sortedProjects, sortedLabels } from '../store/selectors.js';
import { SkewButton } from './Panel.jsx';
import { RepeatIcon, XIcon } from './icons.jsx';

const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };

// Mirrored highlight layer: same text, same font metrics, recognized token
// spans wrapped in colored marks. Scroll is synced from the input.
function Highlights({ value, tokens }) {
  const spans = tokens
    .filter((t) => t.valid !== false || t.type === 'project')
    .slice()
    .sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;
  for (const tok of spans) {
    if (tok.start < cursor) continue;
    if (tok.start > cursor) parts.push({ text: value.slice(cursor, tok.start) });
    parts.push({ text: value.slice(tok.start, tok.end), cls: `tok-${tok.type}${tok.valid === false ? ' tok-invalid' : ''}` });
    cursor = tok.end;
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor) });
  return (
    <>
      {parts.map((p, i) =>
        p.cls ? (
          <mark key={i} className={p.cls}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function removeSpan(value, start, end) {
  return (value.slice(0, start) + value.slice(end)).replace(/\s{2,}/g, ' ').trimStart();
}

export default function QuickAdd() {
  const ctx = useStore((s) => s.quickAddOpen);
  if (!ctx) return null;
  return <QuickAddModal ctx={ctx} />;
}

function QuickAddModal({ ctx }) {
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen);
  const addTask = useStore((s) => s.addTask);
  const addLabel = useStore((s) => s.addLabel);
  const projectsMap = useStore((s) => s.projects);
  const labelsMap = useStore((s) => s.labels);
  const [value, setValue] = useState('');
  const [projectOverride, setProjectOverride] = useState(null);
  const inputRef = useRef(null);
  const highlightRef = useRef(null);

  const projects = useMemo(() => sortedProjects(projectsMap), [projectsMap]);
  const labels = useMemo(() => sortedLabels(labelsMap), [labelsMap]);
  const parse = useMemo(
    () => parseQuickAdd(value, { projects, labels }),
    [value, projects, labels],
  );

  const projectId = parse.projectId ?? projectOverride ?? ctx.projectId ?? 'inbox';
  const due =
    parse.due ??
    (ctx.date ? { date: ctx.date, time: null, recurrence: null, anchor: ctx.date, text: '' } : null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = () => setQuickAddOpen(null);

  const submit = () => {
    if (!parse.title.trim()) return;
    const labelIds = parse.labels.map((l) => (l.known ? l.id : addLabel(l.name))).filter(Boolean);
    addTask({
      title: parse.title,
      projectId,
      sectionId: parse.projectId ? null : (ctx.sectionId ?? null),
      parentId: ctx.parentId ?? null,
      labelIds,
      priority: parse.priority ?? 4,
      due,
    });
    setValue('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const dueTokens = parse.tokens.filter((t) => t.type === 'due');

  return (
    <div className="modal-scrim quickadd-scrim" onMouseDown={close} role="presentation">
      <div className="quickadd panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="quickadd-input-wrap">
          <div className="quickadd-highlights" ref={highlightRef} aria-hidden="true">
            <Highlights value={value} tokens={parse.tokens} />
          </div>
          <input
            ref={inputRef}
            className="quickadd-input"
            value={value}
            placeholder='Slay the dragon tomorrow 9am p1 #quests @errands…'
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onScroll={(e) => {
              if (highlightRef.current) highlightRef.current.scrollLeft = e.target.scrollLeft;
            }}
          />
        </div>
        <div className="quickadd-chips">
          {due ? (
            <span className="chip chip-due chip-due-future">
              {formatChip(due.date)}
              {due.time ? ` ${formatTime(due.time)}` : ''}
              {due.recurrence ? <RepeatIcon size={11} /> : null}
              {dueTokens.length ? (
                <button
                  type="button"
                  className="chip-x"
                  aria-label="Remove date"
                  onClick={() => setValue(removeSpan(value, dueTokens[0].start, dueTokens[dueTokens.length - 1].end))}
                >
                  <XIcon size={10} />
                </button>
              ) : null}
            </span>
          ) : null}
          {parse.priority ? <span className={`chip chip-priority pr${parse.priority}`}>{PRIORITY_LABELS[parse.priority]}</span> : null}
          {parse.labels.map((l) => (
            <span key={l.name} className={`chip chip-label ${l.known ? '' : 'chip-label-new'}`}>
              @{l.name}
              {l.known ? '' : ' (new)'}
            </span>
          ))}
        </div>
        <div className="quickadd-foot">
          <select
            className="select"
            value={projectId}
            onChange={(e) => setProjectOverride(e.target.value)}
            disabled={Boolean(parse.projectId)}
            aria-label="Project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="quickadd-hint">#project ‧ @label ‧ p1–p4 ‧ “tomorrow 5pm” ‧ “every monday”</span>
          <SkewButton onClick={submit} disabled={!parse.title.trim()}>
            ADD TASK
          </SkewButton>
        </div>
      </div>
    </div>
  );
}
