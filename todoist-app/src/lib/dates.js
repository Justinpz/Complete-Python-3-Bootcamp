// Local-timezone day-key helpers. A "key" is 'YYYY-MM-DD' in the user's
// wall-clock timezone — a todo app must bucket days by local time, so all
// day math goes through these instead of Date/UTC directly.

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function keyFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayKey() {
  return keyFromDate(new Date());
}

export function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

// month is 1-12
export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

// Build a key from possibly-overflowing parts: month outside 1-12 rolls the
// year, day is clamped to the target month's length (Jan 31 + 1 month = Feb 28).
export function clampedKey(y, m, d) {
  const ny = y + Math.floor((m - 1) / 12);
  const nm = ((((m - 1) % 12) + 12) % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${pad2(nm)}-${pad2(nd)}`;
}

export function addDays(key, n) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + n);
  return keyFromDate(d);
}

// toKey - fromKey, in whole days
export function diffDays(fromKey, toKey) {
  return Math.round((dateFromKey(toKey) - dateFromKey(fromKey)) / 86400000);
}

// 0=Sun .. 6=Sat
export function weekdayOf(key) {
  return dateFromKey(key).getDay();
}

// ISO keys compare correctly as strings
export function maxKey(a, b) {
  return a >= b ? a : b;
}

export function minKey(a, b) {
  return a <= b ? a : b;
}

export function isOverdue(key, today = todayKey()) {
  return key < today;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayName(key, short = true) {
  const name = WEEKDAYS[weekdayOf(key)];
  return short ? name.slice(0, 3) : name;
}

// Short human date for task chips: Today / Tomorrow / Yesterday, bare weekday
// inside the next week, otherwise "Mon 27 Jul" (+ year when not this year).
export function formatChip(key, today = todayKey()) {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  const { y, m, d } = parts(key);
  const diff = diffDays(today, key);
  if (diff > 1 && diff < 7) return weekdayName(key, false);
  const base = `${weekdayName(key)} ${d} ${MONTHS[m - 1]}`;
  return y === Number(today.slice(0, 4)) ? base : `${base} ${y}`;
}

// Day-group heading for the Upcoming view: "21 Jul ‧ Tomorrow ‧ Monday"
export function formatDayHeading(key, today = todayKey()) {
  const { m, d } = parts(key);
  const dayName = WEEKDAYS[weekdayOf(key)];
  let label;
  if (key === today) label = 'Today';
  else if (key === addDays(today, 1)) label = 'Tomorrow';
  return `${d} ${MONTHS[m - 1]} ‧ ${label ? `${label} ‧ ` : ''}${dayName}`;
}

// '17:30' -> '5:30 PM', '09:00' -> '9 AM'
export function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h24, min] = hhmm.split(':').map(Number);
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return min ? `${h}:${pad2(min)} ${ap}` : `${h} ${ap}`;
}
