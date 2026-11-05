import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnv } from '../src/lib/env';

describe('Environment Variable Resolution (getEnv)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    delete (globalThis as any)[Symbol.for('__cloudflare-context__')];
    delete (globalThis as any).TEST_GLOBAL_VAR;
  });

  it('reads from process.env when present', () => {
    process.env.TEST_SAMPLE_VAR = 'hello_node';
    expect(getEnv('TEST_SAMPLE_VAR')).toBe('hello_node');
  });

  it('falls back to Cloudflare context when process.env is empty', () => {
    delete process.env.DATABASE_URL_CF_TEST;

    (globalThis as any)[Symbol.for('__cloudflare-context__')] = {
      env: {
        DATABASE_URL_CF_TEST: 'postgres://user:pass@cf.neon.tech/neondb',
      },
    };

    expect(getEnv('DATABASE_URL_CF_TEST')).toBe('postgres://user:pass@cf.neon.tech/neondb');
  });

  it('falls back to globalThis bindings', () => {
    delete process.env.TEST_GLOBAL_VAR;
    (globalThis as any).TEST_GLOBAL_VAR = 'global_val';

    expect(getEnv('TEST_GLOBAL_VAR')).toBe('global_val');
  });

  it('returns undefined if not found anywhere', () => {
    expect(getEnv('COMPLETELY_NON_EXISTENT_VAR_xyz')).toBeUndefined();
  });
});
