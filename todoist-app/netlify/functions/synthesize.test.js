// Exercises the function's contract without calling Anthropic. The paths that
// matter here are the ones the client depends on: 503 (no key) must not throw,
// because that is what triggers the on-device fallback.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from './synthesize.js';

const req = (body, method = 'POST') =>
  new Request('https://example.test/.netlify/functions/synthesize', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
});

describe('synthesize function', () => {
  it('rejects non-POST', async () => {
    const res = await handler(req(null, 'GET'));
    expect(res.status).toBe(405);
  });

  it('returns 503 (not a throw) when no API key is configured', async () => {
    const res = await handler(req({ transcript: 'buy milk' }));
    expect(res.status).toBe(503);
    // the client keys off this status to fall back locally
    await expect(res.json()).resolves.toHaveProperty('error');
  });

  it('rejects malformed JSON', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const res = await handler(req('{not json', 'POST'));
    expect(res.status).toBe(400);
  });

  it('short-circuits an empty transcript without calling the model', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const res = await handler(req({ transcript: '   ' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tasks: [] });
  });

  it('surfaces an auth failure as 503 so the client falls back rather than erroring', async () => {
    process.env.ANTHROPIC_API_KEY = 'bad-key';
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    vi.spyOn(Anthropic.prototype, 'constructor').mockImplementation(() => {});
    vi.spyOn(Anthropic.Messages.prototype, 'create').mockRejectedValue(
      Object.assign(new Error('unauthorized'), { status: 401 }),
    );
    const res = await handler(req({ transcript: 'call mom' }));
    expect(res.status).toBe(503);
  });

  it('returns the tool payload on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    vi.spyOn(Anthropic.Messages.prototype, 'create').mockResolvedValue({
      content: [
        { type: 'text', text: 'ignored' },
        { type: 'tool_use', name: 'emit_tasks', input: { tasks: [{ title: 'Call mom' }] } },
      ],
    });
    const res = await handler(req({ transcript: 'i need to call mom', today: '2026-07-20' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tasks: [{ title: 'Call mom' }] });
  });

  it('returns an empty list when the model answers without the tool', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    vi.spyOn(Anthropic.Messages.prototype, 'create').mockResolvedValue({
      content: [{ type: 'text', text: 'no tasks here' }],
    });
    const res = await handler(req({ transcript: 'just thinking out loud' }));
    await expect(res.json()).resolves.toEqual({ tasks: [] });
  });

  it('passes the transcript and context into the prompt', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const create = vi.spyOn(Anthropic.Messages.prototype, 'create').mockResolvedValue({ content: [] });
    await handler(
      req({ transcript: 'buy milk', today: '2026-07-20', projects: ['Work'], labels: ['errands'] }),
    );
    const args = create.mock.calls[0][0];
    expect(args.system).toContain('2026-07-20');
    expect(args.system).toContain('Work');
    expect(args.system).toContain('errands');
    expect(args.messages[0].content).toContain('buy milk');
    expect(args.tool_choice).toEqual({ type: 'tool', name: 'emit_tasks' });
  });
});
