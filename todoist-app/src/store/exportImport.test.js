import { describe, it, expect } from 'vitest';
import { validateDoc } from './exportImport.js';
import { SCHEMA_VERSION } from './persistence.js';

const good = () => ({ schemaVersion: SCHEMA_VERSION, tasks: {}, projects: {}, completionLog: [] });

describe('validateDoc', () => {
  it('accepts a well-formed backup', () => {
    expect(validateDoc(good()).ok).toBe(true);
  });

  it('rejects non-objects and missing schemaVersion', () => {
    expect(validateDoc(null).ok).toBe(false);
    expect(validateDoc('{}').ok).toBe(false);
    expect(validateDoc({ tasks: {}, projects: {} }).ok).toBe(false);
  });

  it('rejects backups from a newer schema version', () => {
    const res = validateDoc({ ...good(), schemaVersion: SCHEMA_VERSION + 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/schema/i);
  });

  it('rejects malformed maps and logs', () => {
    expect(validateDoc({ ...good(), tasks: [] }).ok).toBe(false);
    expect(validateDoc({ ...good(), projects: 'nope' }).ok).toBe(false);
    expect(validateDoc({ ...good(), completionLog: {} }).ok).toBe(false);
  });
});
