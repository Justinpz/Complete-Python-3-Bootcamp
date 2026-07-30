import { describe, it, expect, vi, afterEach } from 'vitest';
import { synthesizeTasks } from './synthesize.js';

const OPTS = {
  projects: [{ id: 'p1', name: 'Side Quests' }],
  labels: [{ id: 'l1', name: 'errands' }],
  today: '2026-07-20',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(impl) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('synthesizeTasks', () => {
  it('uses the AI result when the function responds', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tasks: [
          {
            title: 'Call the dentist',
            priority: 1,
            dueDate: '2026-07-21',
            project: 'Side Quests',
            labels: ['errands'],
            notes: 'about the crown',
          },
        ],
      }),
    }));

    const res = await synthesizeTasks('call the dentist tomorrow', OPTS);
    expect(res.mode).toBe('ai');
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0]).toMatchObject({
      title: 'Call the dentist',
      priority: 1,
      projectId: 'p1',
      notes: 'about the crown',
    });
    expect(res.tasks[0].due.date).toBe('2026-07-21');
    expect(res.tasks[0].labels[0]).toMatchObject({ name: 'errands', known: true, id: 'l1' });
  });

  it('falls back to local extraction when no key is configured (503)', async () => {
    mockFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const res = await synthesizeTasks('i need to buy milk tomorrow', OPTS);
    expect(res.mode).toBe('local');
    expect(res.reason).toBe('no-key');
    expect(res.tasks[0].title).toBe('Buy milk');
  });

  it('falls back when the function is not deployed (404)', async () => {
    mockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    const res = await synthesizeTasks('call mom', OPTS);
    expect(res.mode).toBe('local');
    expect(res.reason).toBe('unavailable');
    expect(res.tasks).toHaveLength(1);
  });

  it('falls back when the network throws', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    const res = await synthesizeTasks('call mom', OPTS);
    expect(res.mode).toBe('local');
    expect(res.reason).toBe('offline');
  });

  it('keeps the local reading when the AI returns nothing for a real note', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ tasks: [] }) }));
    const res = await synthesizeTasks('buy milk', OPTS);
    expect(res.mode).toBe('local');
    expect(res.reason).toBe('empty');
    expect(res.tasks).toHaveLength(1);
  });

  it('discards malformed AI entries instead of trusting them', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tasks: [
          { title: '   ' },
          { notitle: true },
          { title: 'Real one', priority: 9, dueDate: 'not-a-date', project: 'Nonexistent' },
        ],
      }),
    }));
    const res = await synthesizeTasks('something', OPTS);
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0].title).toBe('Real one');
    expect(res.tasks[0].priority).toBeNull(); // 9 rejected
    expect(res.tasks[0].due).toBeNull(); // bad date rejected
    expect(res.tasks[0].projectId).toBeNull(); // unknown project not invented
  });

  it('marks unknown labels as new rather than dropping them', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [{ title: 'Task', labels: ['brandnew'] }] }),
    }));
    const res = await synthesizeTasks('x', OPTS);
    expect(res.tasks[0].labels[0]).toMatchObject({ name: 'brandnew', known: false, id: null });
  });

  it('does not call the network for an empty transcript', async () => {
    const fetchFn = mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ tasks: [] }) }));
    const res = await synthesizeTasks('   ', OPTS);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(res.tasks).toEqual([]);
  });

  it('sends the transcript and context to the function', async () => {
    const fetchFn = mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ tasks: [{ title: 'A' }] }) }));
    await synthesizeTasks('hello world', OPTS);
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      transcript: 'hello world',
      today: '2026-07-20',
      projects: ['Side Quests'],
      labels: ['errands'],
    });
  });
});
