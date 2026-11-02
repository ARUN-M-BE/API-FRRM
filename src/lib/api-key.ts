/**
 * API Key generation and verification.
 */

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function generateApiKey(): string {
  const array = new Uint8Array(24); // 24 bytes = 48 hex characters
  crypto.getRandomValues(array);
  return `frrm_${bufferToHex(array.buffer)}`;
}

export function verifyApiKey(provided: string | null | undefined, expected: string): boolean {
  if (!provided || typeof provided !== 'string') return false;
  if (provided.length !== expected.length) return false;

  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

