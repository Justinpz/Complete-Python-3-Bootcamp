import { describe, it, expect } from 'vitest';
import { splitThoughts, cleanThought, extractTasks } from './braindump.js';

const REF = new Date(2026, 6, 20); // Mon 20 Jul 2026
const OPTS = { refDate: REF, projects: [{ id: 'p1', name: 'Work' }], labels: [{ id: 'l1', name: 'errands' }] };

describe('splitThoughts', () => {
  it('splits on spoken connectives', () => {
    expect(splitThoughts('call the dentist and also pick up milk')).toEqual([
      'call the dentist',
      'pick up milk',
    ]);
  });

  it('splits on punctuation when present', () => {
    expect(splitThoughts('Call mom. Book the flight!')).toEqual(['Call mom.', 'Book the flight!']);
  });

  it('splits a bare "and" only before an action verb', () => {
    expect(splitThoughts('call mom and book the flight')).toHaveLength(2);
    expect(splitThoughts('buy salt and pepper')).toHaveLength(1);
  });

  it('handles a long unpunctuated run', () => {
    const t = 'i need to call the dentist then i need to email sarah oh and buy milk';
    expect(splitThoughts(t)).toHaveLength(3);
  });

  it('returns nothing for empty input', () => {
    expect(splitThoughts('')).toEqual([]);
    expect(splitThoughts('   ')).toEqual([]);
  });
});

describe('cleanThought', () => {
  it('strips lead-ins', () => {
    expect(cleanThought('i need to call the dentist')).toBe('call the dentist');
    expect(cleanThought('remember to water the plants')).toBe('water the plants');
  });

  it('strips filler words', () => {
    expect(cleanThought('um call the uh dentist')).toBe('call the dentist');
  });

  it('strips leading conjunctions and trailing punctuation', () => {
    expect(cleanThought('and then buy milk.')).toBe('buy milk');
  });
});

describe('extractTasks', () => {
  it('turns a monologue into distinct tasks', () => {
    const t = 'um so i need to call the dentist tomorrow and also pick up milk';
    const tasks = extractTasks(t, OPTS);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Call the dentist');
    expect(tasks[0].due.date).toBe('2026-07-21');
    expect(tasks[1].title).toBe('Pick up milk');
  });

  it('reads urgency as P1 and drops the phrase from the title', () => {
    const [task] = extractTasks('i have to submit the report thats urgent', OPTS);
    expect(task.priority).toBe(1);
    expect(task.title).toBe('Submit the report');
  });

  it('reads someday language as P4', () => {
    const [task] = extractTasks('eventually learn guitar', OPTS);
    expect(task.priority).toBe(4);
    expect(task.title).toBe('Learn guitar');
  });

  it('still honors explicit quick-add tokens', () => {
    const [task] = extractTasks('buy stamps @errands p2', OPTS);
    expect(task.priority).toBe(2);
    expect(task.labels[0]).toMatchObject({ name: 'errands', known: true });
    expect(task.title).toBe('Buy stamps');
  });

  it('matches a spoken project reference', () => {
    const [task] = extractTasks('finish the deck #work', OPTS);
    expect(task.projectId).toBe('p1');
  });

  it('deduplicates repeated thoughts', () => {
    const tasks = extractTasks('call mom. and also call mom', OPTS);
    expect(tasks).toHaveLength(1);
  });

  it('keeps the original phrasing as source', () => {
    const [task] = extractTasks('i need to call the dentist', OPTS);
    expect(task.source).toContain('i need to call the dentist');
  });

  it('ignores empty or trivial fragments', () => {
    expect(extractTasks('um. uh. and', OPTS)).toEqual([]);
  });

  it('assigns unique ids', () => {
    const tasks = extractTasks('call mom and buy milk and email sarah', OPTS);
    const ids = new Set(tasks.map((t) => t.id));
    expect(ids.size).toBe(tasks.length);
  });
});
