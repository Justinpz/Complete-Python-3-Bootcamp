// Turns a spoken brain-dump into structured tasks via Claude.
//
// Mirrors the pattern in LEVELED's backend/src/services/aiBuilder.js: the model
// is env-driven so no model string is pinned in source, and a missing key
// returns 503 rather than throwing — the client then falls back to its local
// rule-based extraction, so the app keeps working with no key configured.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_TRANSCRIPT = 12000;

const EMIT_TASKS = {
  name: 'emit_tasks',
  description: 'Return the actionable tasks found in the note.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['tasks'],
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              description: 'Imperative, specific, under ~80 chars. E.g. "Call the dentist about the crown".',
            },
            priority: {
              type: 'integer',
              enum: [1, 2, 3, 4],
              description: '1 = urgent/explicitly stressed, 2 = important, 3 = normal, 4 = someday. Omit if unclear.',
            },
            dueDate: { type: 'string', description: 'YYYY-MM-DD. Only when a date was actually implied.' },
            dueTime: { type: 'string', description: 'HH:mm 24h, only if a time was stated.' },
            project: { type: 'string', description: 'Must exactly match one of the existing project names, or omit.' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Prefer existing labels; omit if none fit.' },
            notes: { type: 'string', description: 'Extra detail worth keeping that does not belong in the title.' },
            source: { type: 'string', description: 'The phrase from the note this task came from.' },
          },
        },
      },
    },
  },
};

function systemPrompt({ today, projects, labels }) {
  return [
    'You turn a spoken, unedited brain-dump into a clean task list.',
    `Today is ${today}.`,
    projects.length ? `Existing projects: ${projects.join(', ')}.` : 'There are no projects yet.',
    labels.length ? `Existing labels: ${labels.join(', ')}.` : 'There are no labels yet.',
    '',
    'Rules:',
    '- Extract only genuine intended actions. Ignore thinking-out-loud, asides and commentary.',
    '- Split compound thoughts into separate tasks; merge restatements of the same intent into one.',
    '- Write titles as imperative actions, not as transcripts of the speech.',
    '- Resolve relative dates ("tomorrow", "next Friday", "end of the month") against today.',
    '- Only set priority when the speaker signalled urgency or lack of it.',
    '- Only set project/labels when they clearly match an existing one. Never invent new projects.',
    '- If the note contains no actionable item, return an empty list.',
    '- Never invent detail that was not said.',
  ].join('\n');
}

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    // Not an error state: the client falls back to local extraction.
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const transcript = String(body?.transcript || '').slice(0, MAX_TRANSCRIPT).trim();
  if (!transcript) return Response.json({ tasks: [] });

  const today = /^\d{4}-\d{2}-\d{2}$/.test(body?.today || '')
    ? body.today
    : new Date().toISOString().slice(0, 10);
  const projects = Array.isArray(body?.projects) ? body.projects.slice(0, 60).map(String) : [];
  const labels = Array.isArray(body?.labels) ? body.labels.slice(0, 60).map(String) : [];

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt({ today, projects, labels }),
      tools: [EMIT_TASKS],
      tool_choice: { type: 'tool', name: 'emit_tasks' },
      messages: [{ role: 'user', content: `Here is the note:\n\n${transcript}` }],
    });

    const block = message.content.find((c) => c.type === 'tool_use' && c.name === 'emit_tasks');
    if (!block) return Response.json({ tasks: [] });
    return Response.json({ tasks: block.input?.tasks ?? [] });
  } catch (err) {
    const status = err?.status === 401 || err?.status === 403 ? 503 : 502;
    console.error('[synthesize] failed:', err?.message || err);
    return Response.json({ error: 'Synthesis failed' }, { status });
  }
};
