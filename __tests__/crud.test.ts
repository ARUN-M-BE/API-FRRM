import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateSalt } from '../src/lib/auth';
import { createSessionToken, verifySessionToken } from '../src/lib/session';
import { generateApiKey, verifyApiKey } from '../src/lib/api-key';

describe('Auth & Security', () => {
  describe('PBKDF2 Password Hashing', () => {
    it('hashes and correctly verifies passwords', async () => {
      const password = 'SuperSecretPassword123!';
      const { hash, salt } = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // 256 bits = 64 hex chars
      expect(salt.length).toBe(32); // 16 bytes = 32 hex chars

      const isValid = await verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);

      const isWrong = await verifyPassword('WrongPassword123!', hash, salt);
      expect(isWrong).toBe(false);
    });
  });

  describe('HMAC-SHA256 Session Management', () => {
    it('creates and verifies a valid signed session token', async () => {
      const userId = '11111111-2222-3333-4444-555555555555';
      const token = await createSessionToken(userId);

      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const session = await verifySessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(userId);
      expect(session?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects tampered session tokens', async () => {
      const userId = '11111111-2222-3333-4444-555555555555';
      const token = await createSessionToken(userId);
      const [payload, sig] = token.split('.');

      // Tamper signature
      const badToken = `${payload}.${sig.slice(0, -4)}xxxx`;
      const session = await verifySessionToken(badToken);
      expect(session).toBeNull();
    });
  });

  describe('API Key Generation & Verification', () => {
    it('generates frrm_ prefixed 48 hex character keys', () => {
      const key = generateApiKey();
      expect(key.startsWith('frrm_')).toBe(true);
      expect(key.length).toBe(5 + 48); // 53 total
    });

    it('constant-time verifies api keys', () => {
      const key = generateApiKey();
      expect(verifyApiKey(key, key)).toBe(true);
      expect(verifyApiKey('frrm_invalid', key)).toBe(false);
      expect(verifyApiKey(null, key)).toBe(false);
    });
  });
});

