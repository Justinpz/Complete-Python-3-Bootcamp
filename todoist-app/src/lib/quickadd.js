// Quick-add parsing: '#project', '@label', 'p1'..'p4' tokens plus natural
// language due phrases (via nldate). Token spans index the original text.
import { parseWhen } from './nldate.js';

function normalizeProjectName(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

function maskRanges(text, ranges) {
  let out = text;
  for (const r of ranges) {
    out = out.slice(0, r.start) + ' '.repeat(r.end - r.start) + out.slice(r.end);
  }
  return out;
}

export function parseQuickAdd(text, { projects = [], labels = [], refDate } = {}) {
  const tokens = [];
  const outLabels = [];
  const removeRanges = []; // stripped from the title
  const maskedRanges = []; // hidden from due parsing (all #/@/pN tokens)
  let projectId = null;
  let priority = null;

  // #project and @label tokens: '#'/'@' + non-space run at a word start.
  const hashAtRe = /(^|\s)([#@]\S+)/g;
  let m;
  while ((m = hashAtRe.exec(text)) !== null) {
    const tok = m[2];
    const start = m.index + m[1].length;
    const end = start + tok.length;
    maskedRanges.push({ start, end });
    if (tok[0] === '#') {
      const wanted = tok.slice(1).toLowerCase();
      const hit = projects.find((p) => normalizeProjectName(p.name) === wanted);
      // Only the first matching #token wins; the rest stay in the title.
      const valid = !!hit && projectId === null;
      if (valid) {
        projectId = hit.id;
        removeRanges.push({ start, end });
      }
      tokens.push({ type: 'project', start, end, text: tok, valid });
    } else {
      const name = tok.slice(1).toLowerCase();
      const hit = labels.find((l) => l.name.toLowerCase() === name);
      // '@home … @home' twice would otherwise become duplicate label chips/ids
      if (!outLabels.some((l) => l.name === name)) {
        outLabels.push({ name, known: !!hit, id: hit ? hit.id : null });
      }
      removeRanges.push({ start, end });
      tokens.push({ type: 'label', start, end, text: tok, valid: true });
    }
  }

  const priRe = /(^|\s)([pP][1-4])(?=\s|$)/g;
  while ((m = priRe.exec(text)) !== null) {
    const tok = m[2];
    const start = m.index + m[1].length;
    const end = start + tok.length;
    priority = Number(tok[1]); // last one wins
    maskedRanges.push({ start, end });
    removeRanges.push({ start, end });
    tokens.push({ type: 'priority', start, end, text: tok, valid: true });
  }

  // Space-masking keeps indices identical, so due spans map onto the original.
  const when = parseWhen(maskRanges(text, maskedRanges), { refDate });
  let due = null;
  if (when.found) {
    due = {
      date: when.date,
      time: when.time,
      recurrence: when.recurrence,
      anchor: when.date,
      text: when.dueText,
    };
    for (const s of when.spans) {
      removeRanges.push({ start: s.start, end: s.end });
      tokens.push({
        type: 'due',
        start: s.start,
        end: s.end,
        text: text.slice(s.start, s.end),
        valid: true,
      });
    }
  }

  removeRanges.sort((a, b) => a.start - b.start);
  let title = '';
  let pos = 0;
  for (const r of removeRanges) {
    title += text.slice(pos, r.start);
    pos = Math.max(pos, r.end);
  }
  title += text.slice(pos);
  title = title.replace(/\s+/g, ' ').trim();

  tokens.sort((a, b) => a.start - b.start);
  return { title, projectId, labels: outLabels, priority, due, tokens };
}
