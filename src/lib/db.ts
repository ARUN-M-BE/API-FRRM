import { neon } from '@neondatabase/serverless';

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

let cachedSql: any = null;

export function getDb(): any {
  if (cachedSql) return cachedSql;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }
  cachedSql = neon(dbUrl);
  return cachedSql;
}

/**
 * Tagged template literal for SQL queries using Neon HTTP serverless client.
 */
export const sql: SqlFunction = ((strings: TemplateStringsArray, ...values: any[]) => {
  const db = getDb();
  return db(strings, ...values);
}) as SqlFunction;

/**
 * Execute dynamic raw SQL safely for DDL / table creation where identifiers
 * have ALREADY been validated with validateIdentifier().
 */
export async function executeRawSql<T = Record<string, any>>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const db = getDb();
  if (params.length === 0) {
    return (db as any).query(query);
  }
  return (db as any).query(query, params);
}
