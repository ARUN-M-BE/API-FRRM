/**
 * SSRF protection for the server-side request proxy.
 *
 * Rules:
 *   - Only http:// and https:// schemes allowed
 *   - Block requests to private / reserved / loopback IPs
 *   - Block known local hostnames
 *   - 15-second timeout via AbortController
 *   - 1 MB response body cap
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254", // Cloud metadata
  "metadata.google",
]);

/**
 * Returns an error string if the URL is disallowed, or null if safe.
 */
export function validateTargetUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Invalid URL";
  }

  // Only http(s)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return `Blocked scheme "${url.protocol}" — only http and https are allowed`;
  }

  // Block known local hostnames
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return `Blocked hostname "${hostname}"`;
  }

  // Block *.local, *.internal
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return `Blocked hostname "${hostname}"`;
  }

  // Block private / reserved IPs
  if (isPrivateOrReservedIP(hostname)) {
    return `Blocked private/reserved IP "${hostname}"`;
  }

  // Block userinfo in URL (potential redirect tricks)
  if (url.username || url.password) {
    return "URLs with credentials are not allowed";
  }

  return null; // safe
}

/**
 * Check if a hostname string is a private or reserved IPv4 address.
 */
function isPrivateOrReservedIP(hostname: string): boolean {
  // Strip brackets for IPv6
  const clean = hostname.replace(/^\[|\]$/g, "");

  // Check IPv4
  const ipv4 = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b, c, d] = ipv4.map(Number);
    // 0.0.0.0/8
    if (a === 0) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 100.64.0.0/10 (CGN)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 (documentation)
    if (a === 192 && b === 0 && c === 2) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (benchmark)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24, 203.0.113.0/24 (documentation)
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    // 224+  (multicast, reserved, broadcast)
    if (a >= 224) return true;
    // Unused `d` — suppress lint
    void d;
  }

  // Block IPv6 loopback ::1 and link-local fe80::
  if (clean === "::1" || clean.startsWith("fe80:") || clean.startsWith("fc") || clean.startsWith("fd")) {
    return true;
  }

  return false;
}

/** Maximum response body size in bytes. */
export const MAX_RESPONSE_BYTES = 1 * 1024 * 1024; // 1 MB

/** Timeout for proxied requests in milliseconds. */
export const PROXY_TIMEOUT_MS = 15_000;

/**
 * Fetch a URL with SSRF protection, timeout, and body cap.
 */
export async function safeFetch(
  url: string,
  init: RequestInit
): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  sizeBytes: number;
  truncated: boolean;
}> {
  const error = validateTargetUrl(url);
  if (error) throw new Error(`SSRF: ${error}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
    });

    const timeMs = Date.now() - start;

    // Collect headers
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    // Read body with cap
    const { text, sizeBytes, truncated } = await readBodyCapped(
      res,
      MAX_RESPONSE_BYTES
    );

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers,
      body: text,
      timeMs,
      sizeBytes,
      truncated,
    };
  } catch (err) {
    const timeMs = Date.now() - start;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${PROXY_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readBodyCapped(
  res: Response,
  maxBytes: number
): Promise<{ text: string; sizeBytes: number; truncated: boolean }> {
  // If Content-Length is available and small, just read it
  const cl = res.headers.get("content-length");
  if (cl && parseInt(cl, 10) <= maxBytes) {
    const text = await res.text();
    return { text, sizeBytes: new TextEncoder().encode(text).length, truncated: false };
  }

  // Stream and cap
  const reader = res.body?.getReader();
  if (!reader) {
    return { text: "", sizeBytes: 0, truncated: false };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (totalBytes + value.byteLength > maxBytes) {
      // Take only what fits
      const remaining = maxBytes - totalBytes;
      if (remaining > 0) chunks.push(value.slice(0, remaining));
      totalBytes = maxBytes;
      truncated = true;
      reader.cancel();
      break;
    }

    chunks.push(value);
    totalBytes += value.byteLength;
  }

  // Concatenate
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder().decode(combined),
    sizeBytes: totalBytes,
    truncated,
  };
}

