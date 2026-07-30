// Turns a spoken monologue into task candidates, with no model involved.
// Speech arrives as one unpunctuated run ("uh I need to call the dentist
// tomorrow and also pick up milk"), so the work is splitting it into
// intentions and stripping the verbal scaffolding around each one.

import { parseQuickAdd } from './quickadd.js';

// Phrases people say to join thoughts out loud. Splitting on these recovers
// the sentence boundaries that speech recognition does not provide.
const CONNECTORS = [
  'and also',
  'and then also',
  'and then',
  'after that',
  'also i need to',
  'also i have to',
  'also i should',
  'also',
  'then i need to',
  'then i have to',
  'next i need to',
  'oh and',
  'oh also',
  'plus i need to',
  'another thing',
  'one more thing',
  'lastly',
  'finally',
];

// Openers that carry no task content once the intention is extracted.
const LEAD_INS = [
  "i need to",
  'i have to',
  'i should',
  'i want to',
  'i gotta',
  'i got to',
  'i must',
  "i've got to",
  'ive got to',
  "don't forget to",
  'dont forget to',
  'remember to',
  'remind me to',
  'make sure to',
  'make sure i',
  'i need',
  'we need to',
  'gotta',
  'need to',
  'have to',
  'todo',
  'to do',
];

// Speech-recognition filler that should never reach a task title. "like" is
// deliberately absent — dropping it mangles real content ("people like Sarah").
const FILLERS = ['um', 'uh', 'erm', 'you know', 'i mean', 'basically', 'so yeah', 'okay so', 'ok so'];

const URGENT_HINTS = [
  'urgent',
  'asap',
  'right away',
  'immediately',
  'critical',
  'top priority',
  'first thing',
  'important',
  'crucial',
  'deadline',
];

const LOW_HINTS = ['someday', 'eventually', 'at some point', 'no rush', 'whenever', 'if i get time', 'maybe'];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CONNECTOR_RE = new RegExp(`\\s+(?:${CONNECTORS.map(escapeRe).join('|')})\\s+`, 'gi');
const LEAD_IN_RE = new RegExp(`^(?:${LEAD_INS.map(escapeRe).join('|')})\\b[\\s,]*`, 'i');
const FILLER_RE = new RegExp(`(?:^|\\s)(?:${FILLERS.map(escapeRe).join('|')})(?=\\s|$|[,.;!?])`, 'gi');
const OPENING_CONJ_RE = /^(?:and|then|also|so|but|okay|ok|yeah|well|now)\b[\s,]*/i;

// Split a transcript into candidate intentions: real punctuation first, then
// spoken connectives, then bare "and" between two verb-led clauses.
export function splitThoughts(text) {
  if (!text || !text.trim()) return [];
  const marked = text
    .replace(/([.!?;])\s+/g, '$1\n')
    .replace(/\s+,\s+(?=(?:and|then|also)\b)/gi, '\n')
    .replace(CONNECTOR_RE, '\n');

  return marked
    .split('\n')
    .flatMap((part) => splitBareAnd(part))
    .map((s) => s.trim())
    .filter(Boolean);
}

// "call mom and book the flight" -> two thoughts, but "salt and pepper" stays
// one. Only split when what follows "and" opens with a verb-like word.
const ACTION_VERBS =
  '(?:call|email|text|message|book|buy|get|pick|order|send|write|draft|finish|start|schedule|' +
  'plan|pay|check|review|read|watch|clean|fix|update|renew|cancel|submit|file|print|' +
  'ask|tell|remind|follow|set|make|do|prep|prepare|reply|respond|confirm|register|apply)';

function splitBareAnd(part) {
  const re = new RegExp(`\\s+and\\s+(?=${ACTION_VERBS}\\b)`, 'i');
  return part.split(re);
}

// Applied to a fixed point: stripping one layer exposes the next, so
// "and then buy milk" and "um so i need to call" both reduce fully.
export function cleanThought(raw) {
  let s = raw;
  let prev;
  do {
    prev = s;
    s = s.replace(/[\s,;.!?]+$/, '');
    s = s.replace(FILLER_RE, ' ');
    s = s.replace(/\s{2,}/g, ' ').trim();
    s = s.replace(LEAD_IN_RE, '');
    s = s.replace(OPENING_CONJ_RE, '');
    s = s.trim();
  } while (s !== prev);
  return s;
}

function detectPriority(text) {
  const lower = text.toLowerCase();
  if (URGENT_HINTS.some((h) => lower.includes(h))) return 1;
  if (LOW_HINTS.some((h) => lower.includes(h))) return 4;
  return null;
}

// Strip an urgency phrase once it has been turned into a priority, so the
// title reads as an action rather than a note to self.
function stripHints(text) {
  let out = text;
  for (const h of [...URGENT_HINTS, ...LOW_HINTS]) {
    out = out.replace(new RegExp(`\\b(?:that's|thats|it's|its)\\s+${escapeRe(h)}\\b`, 'gi'), '');
    out = out.replace(new RegExp(`\\b${escapeRe(h)}\\b`, 'gi'), '');
  }
  return out.replace(/\s{2,}/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '');
}

function titleCaseFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Rule-based extraction: the offline path, and the fallback whenever the
 * synthesis function is unavailable. Each candidate still runs through
 * parseQuickAdd, so spoken dates, priorities and labels are honored.
 *
 * @returns {Array<{id: string, title: string, priority: number|null, due: object|null,
 *   labels: Array, projectId: string|null, source: string}>}
 */
export function extractTasks(transcript, { projects = [], labels = [], refDate } = {}) {
  const out = [];
  const seen = new Set();

  splitThoughts(transcript).forEach((raw, i) => {
    const cleaned = cleanThought(raw);
    if (!cleaned || cleaned.length < 2) return;

    const priorityHint = detectPriority(cleaned);
    const parsed = parseQuickAdd(stripHints(cleaned), { projects, labels, refDate });
    const title = titleCaseFirst(parsed.title.trim());
    if (!title) return;

    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      id: `c${i}`,
      title,
      priority: parsed.priority ?? priorityHint,
      due: parsed.due,
      labels: parsed.labels,
      projectId: parsed.projectId,
      source: raw.trim(),
    });
  });

  return out;
}
