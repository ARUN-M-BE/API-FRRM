/**
 * Safely resolves environment variables across:
 * 1. Node.js (process.env)
 * 2. Next.js server runtime
 * 3. Cloudflare Workers (workerd / OpenNext global context and env bindings)
 */
export function getEnv(name: string): string | undefined {
  // 1. Standard process.env
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }

  // 2. OpenNext / Cloudflare request context via global symbol
  try {
    const cfContext = (globalThis as any)[Symbol.for('__cloudflare-context__')];
    if (cfContext?.env && cfContext.env[name]) {
      return cfContext.env[name];
    }
  } catch {
    // Ignore context lookup errors outside Cloudflare
  }

  // 3. Direct global bindings (Cloudflare Workers platform proxy / global scope)
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as any;
    if (typeof g[name] === 'string' && g[name]) return g[name];
    if (g.env && typeof g.env[name] === 'string' && g.env[name]) return g.env[name];
    if (g.__env__ && typeof g.__env__[name] === 'string' && g.__env__[name]) return g.__env__[name];
  }

  return undefined;
}
