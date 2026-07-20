// Sibling-group ordering. Every orderable entity carries an integer `order`
// scoped to its sibling group; on any reorder the whole affected group is
// rewritten 0..n-1 (groups are small, and integers never degenerate the way
// fractional ranks do).

export function groupKeyOf(task) {
  return `${task.projectId}|${task.sectionId ?? ''}|${task.parentId ?? ''}`;
}

export function sameGroup(a, b) {
  return groupKeyOf(a) === groupKeyOf(b);
}

// Move item (already in arr) to index `to`; returns a new array.
export function arrayMove(arr, from, to) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Insert `item` at `index`, removing any existing occurrence first — covers
// both in-group moves and inserts arriving from another group.
export function insertAt(arr, item, index) {
  const without = arr.filter((x) => x !== item);
  const clamped = Math.max(0, Math.min(index, without.length));
  without.splice(clamped, 0, item);
  return without;
}

// [idA, idB, ...] -> { idA: 0, idB: 1, ... }
export function ordersFromArray(ids) {
  const out = {};
  ids.forEach((id, i) => {
    out[id] = i;
  });
  return out;
}
