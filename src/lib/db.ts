import { neon } from '@neondatabase/serverless';
import { getEnv } from './env';

// Ensure Node.js local environment resolves Neon DNS reliably if local DNS has restrictions
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Agent, setGlobalDispatcher } = require('undici');
    const customLookup = (hostname: string, options: any, callback: any) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (hostname.includes('neon.tech')) {
        const ip = '52.76.246.190';
        if (options && options.all) {
          return callback(null, [{ address: ip, family: 4 }]);
        }
        return callback(null, ip, 4);
      }
      dns.lookup(hostname, options, callback);
    };
    const dispatcher = new Agent({ connect: { lookup: customLookup } });
    setGlobalDispatcher(dispatcher);
  } catch {
    // Edge runtime will safely ignore
  }
}

export type SqlFunction = {
  <T = any[]>(strings: TemplateStringsArray, ...values: any[]): Promise<T>;
};

let cachedDefaultSql: any = null;
const clientCache = new Map<string, any>();

export function getDb(customUrl?: string | null): any {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    const trimmed = customUrl.trim();
    if (clientCache.has(trimmed)) {
      return clientCache.get(trimmed);
    }
    const client = neon(trimmed);
    clientCache.set(trimmed, client);
    return client;
  }

  if (cachedDefaultSql) return cachedDefaultSql;
  const dbUrl =
    getEnv('DATABASE_URL') ||
    getEnv('DATABASE_URL_UNPOOLED');

  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL environment variable is not defined. Ensure DATABASE_URL is set in wrangler.jsonc under "vars" or in Cloudflare Dashboard (Workers & Pages > Settings > Variables and Secrets).'
    );
  }
  cachedDefaultSql = neon(dbUrl);
  return cachedDefaultSql;
}

/**
 * Tagged template literal for SQL queries using the default Neon HTTP serverless client.
 */
export const sql: SqlFunction = ((strings: TemplateStringsArray, ...values: any[]) => {
  const db = getDb();
  return db(strings, ...values);
}) as SqlFunction;

/**
 * Execute dynamic raw SQL safely on the default or an external database.
 */
export async function executeRawSql<T = Record<string, any>>(
  query: string,
  params: any[] = [],
  customDbUrl?: string | null
): Promise<T[]> {
  const db = getDb(customDbUrl);
  if (params.length === 0) {
    return (db as any).query(query);
  }
  return (db as any).query(query, params);
}

/**
 * Test connectivity and credentials of an external database URL.
 */
export async function testDbConnection(
  dbUrl: string
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = performance.now();
  try {
    if (!dbUrl || !dbUrl.startsWith('postgres')) {
      return { success: false, latencyMs: 0, error: 'Database URL must start with postgres:// or postgresql://' };
    }
    const client = neon(dbUrl.trim());
    await (client as any).query('SELECT 1 as ping');
    const latencyMs = Math.round(performance.now() - startTime);
    return { success: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { success: false, latencyMs, error: err?.message || 'Connection failed' };
  }
}
