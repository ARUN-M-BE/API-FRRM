/**
 * Web Crypto API native PBKDF2 password hashing & verification.
 * 100% Edge runtime and Cloudflare Workers compatible (no bcrypt CPU timeout).
 */

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return bufferToHex(array.buffer);
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex || generateSalt();
  const saltBuffer = hexToBuffer(salt);
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  const hash = bufferToHex(derivedBits);
  return { hash, salt };
}

export async function verifyPassword(password: string, storedHash: string, saltHex: string): Promise<boolean> {
  const { hash } = await hashPassword(password, saltHex);
  return hash === storedHash;
}
