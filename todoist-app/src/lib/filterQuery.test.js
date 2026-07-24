import { describe, it, expect } from 'vitest';
import { parseFilter, evaluate } from './filterQuery.js';

const TODAY = '2025-03-10';

// Fixture labels double as their own names; projectNameOf maps ids to
// lowercase spaces-removed names per the ctx contract.
const PROJECT_NAMES = { inbox: 'inbox', work: 'work', side: 'sideproject' };
const ctx = {
  today: TODAY,
  labelNamesOf: (task) => task.labelIds,
  projectNameOf: (task) => PROJECT_NAMES[task.projectId] || '',
};

const task = (over = {}) => ({
  id: 't1',
  labelIds: [],
  priority: 4,
  due: null,
  projectId: 'inbox',
  ...over,
});
const due = (date) => ({ date, time: null, recurrence: null, anchor: date, text: '' });

function run(src, t) {
  const r = parseFilter(src);
  expect(r.ok, `parse failed: ${src} -> ${r.ok ? '' : r.error.message}`).toBe(true);
  return evaluate(r.ast, t, ctx);
}

describe('term semantics', () => {
  const cases = [
    ['today', task({ due: due(TODAY) }), true],
    ['today', task({ due: due('2025-03-11') }), false],
    ['today', task(), false],
    ['tomorrow', task({ due: due('2025-03-11') }), true],
    ['tomorrow', task({ due: due(TODAY) }), false],
    ['tomorrow', task(), false],
    ['overdue', task({ due: due('2025-03-09') }), true],
    ['overdue', task({ due: due(TODAY) }), false],
    ['overdue', task(), false],
    ['no date', task(), true],
    ['no date', task({ due: due(TODAY) }), false],
    ['no labels', task(), true],
    ['no labels', task({ labelIds: ['home'] }), false],
    ['p1', task({ priority: 1 }), true],
    ['p1', task({ priority: 2 }), false],
    ['p2', task({ priority: 2 }), true],
    ['p3', task({ priority: 3 }), true],
    ['p4', task({ priority: 4 }), true],
    ['p4', task({ priority: 1 }), false],
    ['@home', task({ labelIds: ['home', 'errands'] }), true],
    ['@home', task({ labelIds: ['errands'] }), false],
    ['@home', task(), false],
    ['@HOME', task({ labelIds: ['home'] }), true],
    ['#work', task({ projectId: 'work' }), true],
    ['#work', task({ projectId: 'inbox' }), false],
    ['#Work', task({ projectId: 'work' }), true],
    ['#SideProject', task({ projectId: 'side' }), true],
  ];
  it.each(cases)('%s on %o -> %s', (src, t, expected) => {
    expect(run(src, t)).toBe(expected);
  });
});

describe('next N days boundaries', () => {
  const cases = [
    [TODAY, true], // includes today
    ['2025-03-17', true], // includes today + 7
    ['2025-03-18', false], // excludes today + 8
    ['2025-03-09', false], // overdue is out of window
  ];
  it.each(cases)('next 7 days with due %s -> %s', (date, expected) => {
    expect(run('next 7 days', task({ due: due(date) }))).toBe(expected);
  });

  it('is false with no due date', () => {
    expect(run('next 7 days', task())).toBe(false);
  });

  it('next 0 days matches only today', () => {
    expect(run('next 0 days', task({ due: due(TODAY) }))).toBe(true);
    expect(run('next 0 days', task({ due: due('2025-03-11') }))).toBe(false);
  });
});

describe('precedence and grouping', () => {
  it("'p1 | p2 & @home' parses as p1 | (p2 & @home)", () => {
    const r = parseFilter('p1 | p2 & @home');
    expect(r.ok).toBe(true);
    expect(r.ast.type).toBe('or');
    expect(r.ast.left).toEqual({ type: 'term', term: { kind: 'priority', p: 1 } });
    expect(r.ast.right.type).toBe('and');
    expect(r.ast.right.left.term).toEqual({ kind: 'priority', p: 2 });
    expect(r.ast.right.right.term).toEqual({ kind: 'label', name: 'home' });

    expect(run('p1 | p2 & @home', task({ priority: 1 }))).toBe(true);
    expect(run('p1 | p2 & @home', task({ priority: 2, labelIds: ['home'] }))).toBe(true);
    expect(run('p1 | p2 & @home', task({ priority: 2 }))).toBe(false);
  });

  it('parens override precedence', () => {
    const src = '(p1 | p2) & @home';
    expect(run(src, task({ priority: 1 }))).toBe(false);
    expect(run(src, task({ priority: 1, labelIds: ['home'] }))).toBe(true);
    expect(run(src, task({ priority: 2, labelIds: ['home'] }))).toBe(true);
  });
});

describe('negation', () => {
  it('! negates a term', () => {
    expect(run('!p1', task({ priority: 2 }))).toBe(true);
    expect(run('!p1', task({ priority: 1 }))).toBe(false);
  });

  it('! negates a parenthesized expr', () => {
    expect(run('!(today | tomorrow)', task({ due: due('2025-03-20') }))).toBe(true);
    expect(run('!(today | tomorrow)', task({ due: due(TODAY) }))).toBe(false);
  });

  it("'!no date & next 7 days'", () => {
    const src = '!no date & next 7 days';
    expect(run(src, task({ due: due('2025-03-12') }))).toBe(true);
    expect(run(src, task())).toBe(false);
    expect(run(src, task({ due: due('2025-04-01') }))).toBe(false);
  });
});

describe('must-pass examples', () => {
  it("'p1 & today'", () => {
    expect(run('p1 & today', task({ priority: 1, due: due(TODAY) }))).toBe(true);
    expect(run('p1 & today', task({ priority: 1 }))).toBe(false);
    expect(run('p1 & today', task({ priority: 2, due: due(TODAY) }))).toBe(false);
  });

  it("'@errands'", () => {
    expect(run('@errands', task({ labelIds: ['errands'] }))).toBe(true);
    expect(run('@errands', task({ labelIds: ['home'] }))).toBe(false);
  });

  it("'(overdue | today) & #work'", () => {
    const src = '(overdue | today) & #work';
    expect(run(src, task({ projectId: 'work', due: due('2025-03-01') }))).toBe(true);
    expect(run(src, task({ projectId: 'work', due: due(TODAY) }))).toBe(true);
    expect(run(src, task({ projectId: 'inbox', due: due(TODAY) }))).toBe(false);
    expect(run(src, task({ projectId: 'work', due: due('2025-03-11') }))).toBe(false);
  });
});

describe('case and whitespace insensitivity', () => {
  it("'TODAY & P1'", () => {
    expect(run('TODAY & P1', task({ priority: 1, due: due(TODAY) }))).toBe(true);
    expect(run('TODAY & P1', task({ priority: 2, due: due(TODAY) }))).toBe(false);
  });

  it("'No DATE' and 'NEXT 3 DAYS'", () => {
    expect(run('No DATE', task())).toBe(true);
    expect(run('NEXT 3 DAYS', task({ due: due('2025-03-12') }))).toBe(true);
  });

  it('tokens need no surrounding whitespace', () => {
    expect(run('p1&@home|(today)', task({ priority: 1, labelIds: ['home'] }))).toBe(true);
    expect(run('  p1  ', task({ priority: 1 }))).toBe(true);
  });
});

describe('errors', () => {
  const cases = [
    ['p1 &', 4, /expected a term/],
    ['(today', 0, /unclosed/],
    ['no', 2, /'no' must be followed/],
    ['no thing', 3, /'no' must be followed/],
    ['next days', 5, /number/],
    ['next', 4, /number/],
    ['next 7', 6, /'days'/],
    ['@', 0, /label name/],
    ['#', 0, /project name/],
    ['bogusword', 0, /unknown word 'bogusword'/],
    ['today extra', 6, /unexpected 'extra'/],
    ['today)', 5, /unexpected/],
    ['today today', 6, /after end of query/],
    ['', 0, /expected a term/],
    ['|', 0, /expected a term/],
  ];
  it.each(cases)('%s -> error at %i', (src, position, msgRe) => {
    const r = parseFilter(src);
    expect(r.ok).toBe(false);
    expect(r.error.position).toBe(position);
    expect(r.error.message).toMatch(msgRe);
  });

  it('never throws on garbage input', () => {
    for (const src of [') (', '!!!', '&&', '@ #', 'no no no', 'next next days']) {
      expect(() => parseFilter(src)).not.toThrow();
      expect(parseFilter(src).ok).toBe(false);
    }
  });
});
