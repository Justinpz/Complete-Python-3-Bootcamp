// Text-first due-date editor: the same natural-language parser as quick-add,
// plus one-tap presets. Commits a full Due object (or null).

import { useMemo, useState } from 'react';
import { parseWhen } from '../lib/nldate.js';
import { addDays, formatChip, formatTime, todayKey } from '../lib/dates.js';
import { SkewButton } from './Panel.jsx';

export default function DatePicker({ due, onChange, onDone }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseWhen(text) : null), [text]);

  const commit = (nextDue) => {
    onChange(nextDue);
    setText('');
    onDone?.();
  };

  const commitParsed = () => {
    if (!parsed?.found) return;
    commit({
      date: parsed.date,
      time: parsed.time,
      recurrence: parsed.recurrence,
      anchor: parsed.date,
      text: parsed.dueText,
    });
  };

  const preset = (key) => commit({ date: key, time: null, recurrence: null, anchor: key, text: '' });
  const today = todayKey();

  return (
    <div className="datepicker">
      <div className="datepicker-presets">
        <button type="button" className="preset" onClick={() => preset(today)}>
          Today
        </button>
        <button type="button" className="preset" onClick={() => preset(addDays(today, 1))}>
          Tomorrow
        </button>
        <button type="button" className="preset" onClick={() => preset(addDays(today, 7))}>
          Next week
        </button>
        <button type="button" className="preset preset-clear" onClick={() => commit(null)}>
          No date
        </button>
      </div>
      <div className="datepicker-input-row">
        <input
          className="text-input"
          value={text}
          placeholder='“friday 3pm”, “every 2 weeks”, “aug 15”…'
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitParsed();
            }
          }}
        />
        <SkewButton kind="ghost" onClick={commitParsed} disabled={!parsed?.found}>
          SET
        </SkewButton>
      </div>
      <div className="datepicker-preview">
        {parsed
          ? parsed.found
            ? `→ ${formatChip(parsed.date)}${parsed.time ? ` ${formatTime(parsed.time)}` : ''}${
                parsed.recurrence ? ` ‧ ${parsed.dueText}` : ''
              }`
            : 'No date recognized yet…'
          : due
            ? `Currently: ${formatChip(due.date)}${due.time ? ` ${formatTime(due.time)}` : ''}${
                due.recurrence ? ` ‧ repeats (${due.text || 'custom'})` : ''
              }`
            : 'No due date set.'}
      </div>
    </div>
  );
}
