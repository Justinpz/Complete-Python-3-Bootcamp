import { describe, it, expect } from 'vitest';
import { groupKeyOf, sameGroup, arrayMove, insertAt, ordersFromArray } from './order.js';

describe('groupKeyOf', () => {
  it('keys by project, section, parent', () => {
    expect(groupKeyOf({ projectId: 'p', sectionId: 's', parentId: 't' })).toBe('p|s|t');
    expect(groupKeyOf({ projectId: 'p', sectionId: null, parentId: null })).toBe('p||');
  });

  it('sameGroup distinguishes section and parent', () => {
    const base = { projectId: 'p', sectionId: null, parentId: null };
    expect(sameGroup(base, { ...base })).toBe(true);
    expect(sameGroup(base, { ...base, sectionId: 's' })).toBe(false);
    expect(sameGroup(base, { ...base, parentId: 'x' })).toBe(false);
  });
});

describe('arrayMove', () => {
  it('moves forward and backward without mutating', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(arrayMove(arr, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(arrayMove(arr, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(arr).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('insertAt', () => {
  it('inserts a new item', () => {
    expect(insertAt(['a', 'b'], 'x', 1)).toEqual(['a', 'x', 'b']);
  });

  it('moves an existing item instead of duplicating', () => {
    expect(insertAt(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
  });

  it('clamps out-of-range indices', () => {
    expect(insertAt(['a'], 'x', 99)).toEqual(['a', 'x']);
    expect(insertAt(['a'], 'x', -5)).toEqual(['x', 'a']);
  });
});

describe('ordersFromArray', () => {
  it('maps ids to their index', () => {
    expect(ordersFromArray(['x', 'y'])).toEqual({ x: 0, y: 1 });
    expect(ordersFromArray([])).toEqual({});
  });
});
