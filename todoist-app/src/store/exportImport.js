// JSON backup: export downloads the exact persisted document; import
// validates, confirms, and replaces the store state. Round-trip is lossless
// because the export *is* the persistence document.

import { todayKey } from '../lib/dates.js';
import { serialize } from './persistence.js';

export function exportBackup(state) {
  const doc = serialize(state);
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todoist-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateDoc(doc) {
  if (!doc || typeof doc !== 'object') return { ok: false, error: 'Not a JSON object.' };
  if (typeof doc.schemaVersion !== 'number') {
    return { ok: false, error: 'Missing schemaVersion — not a LEVELED Tasks backup.' };
  }
  for (const key of ['tasks', 'projects']) {
    if (!doc[key] || typeof doc[key] !== 'object' || Array.isArray(doc[key])) {
      return { ok: false, error: `Backup is missing its "${key}" map.` };
    }
  }
  if (doc.completionLog && !Array.isArray(doc.completionLog)) {
    return { ok: false, error: 'completionLog must be an array.' };
  }
  return { ok: true };
}

export function readBackupFile(file) {
  return file.text().then((text) => {
    const doc = JSON.parse(text);
    const check = validateDoc(doc);
    if (!check.ok) throw new Error(check.error);
    return doc;
  });
}
