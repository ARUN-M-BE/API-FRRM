/**
 * AES-GCM encryption for secret environment variable values.
 * Uses the Web Crypto API — works on Edge / Cloudflare Workers.
 */

const ENC_ALG = "AES-GCM";
const IV_BYTES = 12;
const KEY_USAGE: KeyUsage[] = ["encrypt", "decrypt"];

// Derive a CryptoKey from the SESSION_SECRET env var via HKDF
let _cachedKey: CryptoKey | null = null;

async function getDerivedKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  const secret =
    process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("ENCRYPTION_KEY or SESSION_SECRET must be set");

  const enc = new TextEncoder();

  // Import raw secret as HKDF key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM-256 key
  _cachedKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("api-frrm-env-encryption"),
      info: enc.encode("aes-gcm-key"),
    },
    keyMaterial,
    { name: ENC_ALG, length: 256 },
    false,
    KEY_USAGE
  );

  return _cachedKey;
}

/** Encrypt a plaintext string → base64 ciphertext (iv prepended). */
export async function encryptValue(plaintext: string): Promise<string> {
  const key = await getDerivedKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: ENC_ALG, iv },
    key,
    encoded
  );

  // Combine iv + ciphertext
  const combined = new Uint8Array(IV_BYTES + cipherBuf.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipherBuf), IV_BYTES);

  return bufToBase64(combined);
}

/** Decrypt a base64 ciphertext → plaintext string. */
export async function decryptValue(ciphertext: string): Promise<string> {
  const key = await getDerivedKey();
  const combined = base64ToBuf(ciphertext);

  const iv = combined.slice(0, IV_BYTES);
  const data = combined.slice(IV_BYTES);

  const plainBuf = await crypto.subtle.decrypt(
    { name: ENC_ALG, iv },
    key,
    data
  );

  return new TextDecoder().decode(plainBuf);
}

/** Mask a secret value for display: show first 3 chars + ••• */
export function maskSecret(value: string): string {
  if (value.length <= 3) return "•••";
  return value.slice(0, 3) + "•".repeat(Math.min(value.length - 3, 12));
}

// --- helpers ---

function bufToBase64(buf: Uint8Array): string {
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

