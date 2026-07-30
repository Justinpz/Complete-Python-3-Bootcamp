import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store.js';
import { useSpeechCapture } from '../lib/speech.js';
import { synthesizeTasks } from '../lib/synthesize.js';
import { sortedProjects, sortedLabels } from '../store/selectors.js';
import { todayKey, formatChip, formatTime } from '../lib/dates.js';
import { SkewButton, IconButton } from './Panel.jsx';
import { MicIcon, StopIcon, XIcon, CheckIcon, SparkIcon } from './icons.jsx';

const PRIORITY_LABELS = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };

const FALLBACK_NOTE = {
  'no-key': 'Sorted on-device — add an API key to have Claude organize these.',
  unavailable: 'Sorted on-device — the synthesis service is not reachable.',
  offline: 'Sorted on-device — you appear to be offline.',
  timeout: 'Sorted on-device — synthesis took too long.',
  empty: 'Sorted on-device.',
};

function CandidateRow({ candidate, checked, onToggle, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(candidate.title);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== candidate.title) onEdit(t);
    else setDraft(candidate.title);
    setEditing(false);
  };

  return (
    <div className={`candidate ${checked ? '' : 'candidate-off'}`}>
      <button
        type="button"
        className={`candidate-check ${checked ? 'on' : ''}`}
        role="checkbox"
        aria-checked={checked}
        aria-label={`Include "${candidate.title}"`}
        onClick={onToggle}
      >
        <CheckIcon size={12} />
      </button>
      <div className="candidate-main">
        {editing ? (
          <input
            className="text-input text-input-mini"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(candidate.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button type="button" className="candidate-title" onClick={() => setEditing(true)}>
            {candidate.title}
          </button>
        )}
        <div className="candidate-meta">
          {candidate.due ? (
            <span className="chip chip-due chip-due-future">
              {formatChip(candidate.due.date)}
              {candidate.due.time ? ` ${formatTime(candidate.due.time)}` : ''}
            </span>
          ) : null}
          {candidate.priority ? (
            <span className={`chip chip-priority pr${candidate.priority}`}>
              {PRIORITY_LABELS[candidate.priority]}
            </span>
          ) : null}
          {candidate.labels?.map((l) => (
            <span key={l.name} className={`chip chip-label ${l.known ? '' : 'chip-label-new'}`}>
              @{l.name}
              {l.known ? '' : ' (new)'}
            </span>
          ))}
          {candidate.notes ? <span className="chip chip-notes">≡</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function VoiceNote() {
  const open = useStore((s) => s.voiceOpen);
  if (!open) return null;
  return <VoiceNoteModal />;
}

function VoiceNoteModal() {
  const setVoiceOpen = useStore((s) => s.setVoiceOpen);
  const addTask = useStore((s) => s.addTask);
  const addLabel = useStore((s) => s.addLabel);
  const pushToast = useStore((s) => s.pushToast);
  const projectsMap = useStore((s) => s.projects);
  const labelsMap = useStore((s) => s.labels);

  const projects = useMemo(() => sortedProjects(projectsMap), [projectsMap]);
  const labels = useMemo(() => sortedLabels(labelsMap), [labelsMap]);

  const { supported, listening, finalText, interimText, error, start, stop, reset, setFinalText } =
    useSpeechCapture();

  const [phase, setPhase] = useState('capture'); // capture | thinking | review
  const [candidates, setCandidates] = useState([]);
  const [excluded, setExcluded] = useState(() => new Set());
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState(null);
  const transcriptRef = useRef(null);

  const transcript = `${finalText}${interimText ? ` ${interimText}` : ''}`.trim();

  // Keep the newest words in view while dictating.
  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    stop();
    setVoiceOpen(false);
  };

  const runSynthesis = async () => {
    stop();
    const text = `${finalText} ${interimText}`.trim();
    if (!text) return;
    setPhase('thinking');
    const result = await synthesizeTasks(text, { projects, labels, today: todayKey() });
    setCandidates(result.tasks);
    setExcluded(new Set());
    setMode(result.mode);
    setReason(result.reason ?? null);
    setPhase('review');
  };

  const commit = () => {
    const chosen = candidates.filter((c) => !excluded.has(c.id));
    if (!chosen.length) return;
    for (const c of chosen) {
      const labelIds = (c.labels || [])
        .map((l) => (l.known ? l.id : addLabel(l.name)))
        .filter(Boolean);
      addTask({
        title: c.title,
        notes: c.notes || '',
        projectId: c.projectId || 'inbox',
        labelIds,
        priority: c.priority ?? 4,
        due: c.due,
      });
    }
    pushToast({
      kind: 'info',
      text: `Added ${chosen.length} task${chosen.length === 1 ? '' : 's'}`,
      sub: mode === 'ai' ? 'Organized by Claude' : 'From your note',
    });
    setVoiceOpen(false);
  };

  const startOver = () => {
    reset();
    setCandidates([]);
    setExcluded(new Set());
    setMode(null);
    setReason(null);
    setPhase('capture');
  };

  const keptCount = candidates.length - excluded.size;

  return (
    <div className="modal-scrim" onMouseDown={close} role="presentation">
      <div
        className="voice panel"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Voice note"
      >
        <div className="voice-head">
          <h2 className="voice-title">
            {phase === 'review' ? 'What I heard' : 'Brain dump'}
          </h2>
          {phase === 'review' && mode ? (
            <span className={`chip ${mode === 'ai' ? 'chip-xp' : ''}`}>
              {mode === 'ai' ? (
                <>
                  <SparkIcon size={11} /> Claude
                </>
              ) : (
                'On-device'
              )}
            </span>
          ) : null}
          <IconButton label="Close" onClick={close}>
            <XIcon size={16} />
          </IconButton>
        </div>

        {phase === 'capture' && (
          <>
            <p className="voice-hint">
              {supported
                ? 'Talk it through — everything, in any order. Say “tomorrow”, “urgent” or a project name and it will be picked up.'
                : 'This browser can’t listen (try Chrome or Safari), but you can type or paste your note below.'}
            </p>

            <div className="voice-transcript" ref={transcriptRef}>
              <textarea
                className="voice-textarea"
                value={transcript}
                placeholder={supported ? 'Tap the mic and start talking…' : 'Type your brain dump here…'}
                onChange={(e) => {
                  setFinalText(e.target.value);
                }}
                aria-label="Transcript"
              />
              {listening ? (
                <div className="voice-listening">
                  <span className="voice-pulse" />
                  Listening…
                </div>
              ) : null}
            </div>

            {error ? <div className="voice-error">{error}</div> : null}

            <div className="voice-actions">
              {supported ? (
                <button
                  type="button"
                  className={`mic-btn ${listening ? 'mic-live' : ''}`}
                  onClick={listening ? stop : start}
                  aria-label={listening ? 'Stop listening' : 'Start listening'}
                >
                  {listening ? <StopIcon size={20} /> : <MicIcon size={20} />}
                </button>
              ) : null}
              <span className="voice-count">
                {transcript ? `${transcript.split(/\s+/).filter(Boolean).length} words` : ''}
              </span>
              <SkewButton onClick={runSynthesis} disabled={!transcript}>
                MAKE MY LIST
              </SkewButton>
            </div>
          </>
        )}

        {phase === 'thinking' && (
          <div className="voice-thinking">
            <span className="voice-pulse" />
            <span>Sorting it out…</span>
          </div>
        )}

        {phase === 'review' && (
          <>
            {candidates.length ? (
              <>
                <p className="voice-hint">
                  Tap a title to edit it, uncheck anything you don’t want.
                  {reason && FALLBACK_NOTE[reason] ? ` ${FALLBACK_NOTE[reason]}` : ''}
                </p>
                <div className="candidate-list">
                  {candidates.map((c) => (
                    <CandidateRow
                      key={c.id}
                      candidate={c}
                      checked={!excluded.has(c.id)}
                      onToggle={() =>
                        setExcluded((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                      onEdit={(title) =>
                        setCandidates((prev) => prev.map((x) => (x.id === c.id ? { ...x, title } : x)))
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-title">NOTHING TO DO</div>
                <div className="empty-sub">No actions found in that note.</div>
              </div>
            )}

            <div className="voice-actions">
              <button type="button" className="mini-btn" onClick={startOver}>
                Start over
              </button>
              <span className="voice-count">{keptCount ? `${keptCount} selected` : ''}</span>
              <SkewButton onClick={commit} disabled={!keptCount}>
                ADD {keptCount || ''} TASK{keptCount === 1 ? '' : 'S'}
              </SkewButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
