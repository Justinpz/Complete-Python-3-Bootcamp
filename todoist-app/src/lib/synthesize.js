// Talks to the serverless synthesis function when one is deployed, and falls
// back to local rule-based extraction otherwise. The app must stay useful with
// no backend at all, so every failure path returns usable tasks.

import { extractTasks } from './braindump.js';

const ENDPOINT = '/.netlify/functions/synthesize';
const TIMEOUT_MS = 20000;

// Shape returned by the function, mapped onto what the review list expects.
function normalize(raw, { projects, labels }) {
  const projectByName = new Map(
    projects.map((p) => [p.name.toLowerCase().replace(/\s+/g, ''), p.id]),
  );
  const labelByName = new Map(labels.map((l) => [l.name.toLowerCase(), l.id]));

  return (raw.tasks || [])
    .filter((t) => t && typeof t.title === 'string' && t.title.trim())
    .map((t, i) => {
      const date = typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : null;
      const names = Array.isArray(t.labels) ? t.labels : [];
      return {
        id: `s${i}`,
        title: t.title.trim().slice(0, 200),
        priority: [1, 2, 3, 4].includes(t.priority) ? t.priority : null,
        due: date
          ? { date, time: t.dueTime || null, recurrence: null, anchor: date, text: '' }
          : null,
        labels: names.map((n) => {
          const name = String(n).toLowerCase().replace(/[\s&|()!#@]/g, '');
          return { name, known: labelByName.has(name), id: labelByName.get(name) ?? null };
        }),
        projectId: t.project ? (projectByName.get(String(t.project).toLowerCase().replace(/\s+/g, '')) ?? null) : null,
        notes: typeof t.notes === 'string' ? t.notes : '',
        source: typeof t.source === 'string' ? t.source : '',
      };
    });
}

/**
 * @returns {Promise<{tasks: Array, mode: 'ai'|'local', reason?: string}>}
 */
export async function synthesizeTasks(transcript, { projects = [], labels = [], today, signal } = {}) {
  const local = () => ({ tasks: extractTasks(transcript, { projects, labels }), mode: 'local' });
  if (!transcript.trim()) return { tasks: [], mode: 'local' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        today,
        projects: projects.map((p) => p.name),
        labels: labels.map((l) => l.name),
      }),
      signal: controller.signal,
    });

    // 404 = no function deployed; 503 = deployed but no API key configured.
    if (!res.ok) {
      return { ...local(), reason: res.status === 503 ? 'no-key' : 'unavailable' };
    }

    const data = await res.json();
    const tasks = normalize(data, { projects, labels });
    // An empty AI result on a non-empty transcript is more likely a bad
    // response than a genuinely taskless note — keep the local reading.
    if (!tasks.length) return { ...local(), reason: 'empty' };
    return { tasks, mode: 'ai' };
  } catch (err) {
    return { ...local(), reason: err.name === 'AbortError' ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
