import { describe, it, expect, beforeAll } from "vitest";
import { encryptValue, decryptValue, maskSecret } from "../src/lib/encryption";

describe("AES-GCM Encryption Engine", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
  });

  it("encrypts and decrypts text round-trip", async () => {
    const secretText = "super_secret_api_key_123456789";
    const ciphertext = await encryptValue(secretText);
    expect(ciphertext).toBeDefined();
    expect(ciphertext).not.toBe(secretText);

    const decrypted = await decryptValue(ciphertext);
    expect(decrypted).toBe(secretText);
  });

  it("produces different ciphertexts for the same plaintext due to random IV", async () => {
    const secretText = "same_secret_text";
    const cipher1 = await encryptValue(secretText);
    const cipher2 = await encryptValue(secretText);
    expect(cipher1).not.toBe(cipher2);

    expect(await decryptValue(cipher1)).toBe(secretText);
    expect(await decryptValue(cipher2)).toBe(secretText);
  });

  it("masks secret values correctly for UI display", () => {
    expect(maskSecret("short")).toBe("sho••");
    expect(maskSecret("frrm_secret_key_long_string_123")).toBe("frr••••••••••••");
    expect(maskSecret("ab")).toBe("•••");
  });
});

