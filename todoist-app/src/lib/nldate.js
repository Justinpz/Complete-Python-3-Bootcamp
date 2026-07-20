// Natural-language due-date parsing: a hand-rolled recurrence layer runs
// first, then chrono-node handles concrete dates/times on the remainder.
import * as chrono from 'chrono-node';
import { keyFromDate, addDays, weekdayOf, parts, clampedKey, pad2 } from './dates.js';

const WEEKDAY_NUM = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

// Full names before abbrevs so 'monday' is not consumed as 'mon' + 'day'.
const WD =
  '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|thurs|thur|sun|mon|tue|wed|thu|fri|sat)';

function makeRule(freq, bang, { interval = 1, byDay = null, byMonthDay = null } = {}) {
  return { freq, interval, byDay, byMonthDay, fromCompletion: !!bang };
}

// Ordered most-specific-first; the first regex that matches wins.
// In each regex, group 1 is the optional '!' of 'every!'.
const RECURRENCE_PATTERNS = [
  {
    re: /\bevery(!)?\s+other\s+week\b/i,
    build: (m) => ({ rule: makeRule('weekly', m[1], { interval: 2 }) }),
  },
  {
    re: /\bevery(!)?\s+(\d+)\s+days?\b/i,
    build: (m) => ({ rule: makeRule('daily', m[1], { interval: Number(m[2]) }) }),
  },
  {
    re: /\bevery(!)?\s+(\d+)\s+weeks?\b/i,
    build: (m) => ({ rule: makeRule('weekly', m[1], { interval: Number(m[2]) }) }),
  },
  {
    re: /\bevery(!)?\s+(\d+)\s+months?\b/i,
    build: (m) => ({ rule: makeRule('monthly', m[1], { interval: Number(m[2]) }) }),
  },
  {
    re: /\bevery(!)?\s+(\d+)\s+years?\b/i,
    build: (m) => ({ rule: makeRule('yearly', m[1], { interval: Number(m[2]) }) }),
  },
  {
    re: /\bevery(!)?\s+weekday\b/i,
    build: (m) => ({ rule: makeRule('weekly', m[1], { byDay: [1, 2, 3, 4, 5] }) }),
  },
  {
    re: /\bevery(!)?\s+weekend\b/i,
    build: (m) => ({ rule: makeRule('weekly', m[1], { byDay: [0, 6] }) }),
  },
  {
    re: /\bevery(!)?\s+morning\b/i,
    build: (m) => ({ rule: makeRule('daily', m[1]), time: '09:00' }),
  },
  {
    re: /\bevery(!)?\s+(?:evening|night)\b/i,
    build: (m) => ({ rule: makeRule('daily', m[1]), time: '19:00' }),
  },
  {
    re: /\bevery(!)?\s+day\b/i,
    build: (m) => ({ rule: makeRule('daily', m[1]) }),
  },
  {
    re: /\b(?:everyday|daily)\b/i,
    build: () => ({ rule: makeRule('daily', false) }),
  },
  {
    re: /\bevery(!)?\s+week\b/i,
    build: (m) => ({ rule: makeRule('weekly', m[1]) }),
  },
  {
    re: /\bevery(!)?\s+last\s+day(?:\s+of\s+the\s+month)?\b/i,
    build: (m) => ({ rule: makeRule('monthly', m[1], { byMonthDay: 31 }) }),
  },
  {
    re: /\bevery(!)?\s+month\b/i,
    build: (m) => ({ rule: makeRule('monthly', m[1]) }),
  },
  {
    re: /\bevery(!)?\s+year\b/i,
    build: (m) => ({ rule: makeRule('yearly', m[1]) }),
  },
  {
    re: /\byearly\b/i,
    build: () => ({ rule: makeRule('yearly', false) }),
  },
  {
    re: /\bevery(!)?\s+(\d{1,2})(?:st|nd|rd|th)\b/i,
    build: (m) => {
      const day = Number(m[2]);
      if (day < 1 || day > 31) return null;
      return { rule: makeRule('monthly', m[1], { byMonthDay: day }) };
    },
  },
  {
    re: new RegExp(`\\bevery(!)?\\s+(${WD}(?:\\s*(?:,|and|&)\\s*${WD})*)\\b`, 'i'),
    build: (m) => {
      const names = m[2].toLowerCase().split(/\s*(?:,|and|&)\s*/).filter(Boolean);
      const byDay = [...new Set(names.map((n) => WEEKDAY_NUM[n]))].sort((a, b) => a - b);
      return { rule: makeRule('weekly', m[1], { byDay }) };
    },
  },
];

function detectRecurrence(text) {
  for (const { re, build } of RECURRENCE_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const built = build(m);
    if (!built) continue;
    return { ...built, span: { start: m.index, end: m.index + m[0].length } };
  }
  return null;
}

// First occurrence of a rule on/after day-key t (duplicated deliberately;
// recurrence.js owns the full nextOccurrence logic).
function firstOccurrenceKey(rule, t) {
  if (rule.freq === 'weekly' && rule.byDay && rule.byDay.length) {
    for (let i = 0; i < 7; i++) {
      const k = addDays(t, i);
      if (rule.byDay.includes(weekdayOf(k))) return k;
    }
  }
  if (rule.freq === 'monthly' && rule.byMonthDay != null) {
    const { y, m } = parts(t);
    const inThisMonth = clampedKey(y, m, rule.byMonthDay);
    return inThisMonth >= t ? inThisMonth : clampedKey(y, m + 1, rule.byMonthDay);
  }
  return t;
}

function maskSpan(text, span) {
  return text.slice(0, span.start) + ' '.repeat(span.end - span.start) + text.slice(span.end);
}

// A chrono hit that is only digits/whitespace is a false positive ('buy 2 apples').
function isJunkMatch(matched) {
  return /^[\d\s]*$/.test(matched);
}

function timeFrom(result) {
  const h = result.start.get('hour');
  const min = result.start.isCertain('minute') ? result.start.get('minute') : 0;
  return `${pad2(h)}:${pad2(min)}`;
}

// Pull a leading connector word ('starting jul 1', 'from aug 3', 'by friday')
// into the span so it does not survive in cleanedText.
function extendOverConnector(text, span) {
  const m = /(?:\b(?:starting|from|on|at|by)\s+)$/i.exec(text.slice(0, span.start));
  return m ? { start: span.start - m[0].length, end: span.end } : span;
}

// Merge spans separated by whitespace only, so dueText reads as one phrase.
function mergeSpans(text, spans) {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && (s.start <= last.end || /^\s*$/.test(text.slice(last.end, s.start)))) {
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

function removeSpans(text, spans) {
  let out = '';
  let pos = 0;
  for (const s of spans) {
    out += text.slice(pos, s.start);
    pos = s.end;
  }
  out += text.slice(pos);
  return out.replace(/\s+/g, ' ').trim();
}

export function parseWhen(text, { refDate = new Date() } = {}) {
  const todayK = keyFromDate(refDate);
  const rawSpans = [];
  let date = null;
  let time = null;
  let recurrence = null;

  const rec = detectRecurrence(text);
  let chronoInput = text;
  let chronoOpts = { forwardDate: true };
  if (rec) {
    recurrence = rec.rule;
    time = rec.time || null;
    date = firstOccurrenceKey(recurrence, todayK);
    rawSpans.push(rec.span);
    chronoInput = maskSpan(text, rec.span);
    // No forwardDate here: 'starting jul 1' may be a past anchor that fixes cadence.
    chronoOpts = {};
  }

  const result = chrono.casual
    .parse(chronoInput, refDate, chronoOpts)
    .find((r) => !isJunkMatch(r.text));

  if (result) {
    const span = extendOverConnector(text, {
      start: result.index,
      end: result.index + result.text.length,
    });
    if (rec) {
      const hasExplicitDate =
        result.start.isCertain('day') || result.start.isCertain('weekday');
      const hasTime = result.start.isCertain('hour');
      if (hasExplicitDate) date = keyFromDate(result.start.date());
      if (hasTime) time = timeFrom(result);
      if (hasExplicitDate || hasTime) rawSpans.push(span);
    } else {
      date = keyFromDate(result.start.date());
      if (result.start.isCertain('hour')) time = timeFrom(result);
      rawSpans.push(span);
    }
  }

  const found = !!(rec || result);
  const spans = mergeSpans(text, rawSpans);
  return {
    found,
    date: found ? date : null,
    time: found ? time : null,
    recurrence,
    spans,
    cleanedText: removeSpans(text, spans),
    dueText: spans.map((s) => text.slice(s.start, s.end)).join(' '),
  };
}
