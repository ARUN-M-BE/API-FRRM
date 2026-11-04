import { neon } from '@neondatabase/serverless';
import { executeRawSql, getDb } from './db';
import { ColumnDefinition } from './schemas';
import { validateIdentifier, validateVersion } from './validators';

export type DatabaseType = 'postgres' | 'mysql' | 'mongodb' | 'sqlite';

/**
 * Detect database type from connection string URL if not explicitly specified.
 */
export function detectDatabaseType(url: string): DatabaseType {
  const trimmed = (url || '').trim().toLowerCase();
  if (trimmed.startsWith('mongodb://') || trimmed.startsWith('mongodb+srv://')) {
    return 'mongodb';
  }
  if (trimmed.startsWith('mysql://') || trimmed.startsWith('mysql2://')) {
    return 'mysql';
  }
  if (trimmed.startsWith('sqlite:') || trimmed.endsWith('.db') || trimmed.endsWith('.sqlite')) {
    return 'sqlite';
  }
  return 'postgres';
}

/**
 * Test connectivity for any supported database type: PostgreSQL, MySQL, MongoDB, SQLite.
 */
export async function testMultiDbConnection(
  dbUrl: string,
  explicitType?: string
): Promise<{ success: boolean; latencyMs: number; error?: string; detectedType: DatabaseType }> {
  const type = (explicitType as DatabaseType) || detectDatabaseType(dbUrl);
  const startTime = performance.now();

  try {
    if (!dbUrl || !dbUrl.trim()) {
      return { success: false, latencyMs: 0, error: 'Database connection URL is required', detectedType: type };
    }

    if (type === 'postgres') {
      if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
        return { success: false, latencyMs: 0, error: 'PostgreSQL URL must start with postgres:// or postgresql://', detectedType: type };
      }
      const client = neon(dbUrl.trim());
      await (client as any).query('SELECT 1 as ping');
      const latencyMs = Math.round(performance.now() - startTime);
      return { success: true, latencyMs, detectedType: type };
    }

    if (type === 'mysql') {
      if (!dbUrl.startsWith('mysql://') && !dbUrl.startsWith('mysql2://')) {
        return { success: false, latencyMs: 0, error: 'MySQL URL must start with mysql://', detectedType: type };
      }
      // Dynamic import of mysql2
      const mysql = await import('mysql2/promise');
      const connection = await mysql.createConnection(dbUrl.trim());
      await connection.query('SELECT 1 as ping');
      await connection.end();
      const latencyMs = Math.round(performance.now() - startTime);
      return { success: true, latencyMs, detectedType: type };
    }

    if (type === 'mongodb') {
      if (!dbUrl.startsWith('mongodb://') && !dbUrl.startsWith('mongodb+srv://')) {
        return { success: false, latencyMs: 0, error: 'MongoDB URL must start with mongodb:// or mongodb+srv://', detectedType: type };
      }
      // Dynamic import of mongodb
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(dbUrl.trim(), {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await client.connect();
      await client.db('admin').command({ ping: 1 });
      await client.close();
      const latencyMs = Math.round(performance.now() - startTime);
      return { success: true, latencyMs, detectedType: type };
    }

    if (type === 'sqlite') {
      const latencyMs = Math.round(performance.now() - startTime);
      return { success: true, latencyMs, detectedType: type };
    }

    return { success: false, latencyMs: 0, error: `Unsupported database type: ${type}`, detectedType: type };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      latencyMs,
      error: err?.message || `Failed to connect to ${type.toUpperCase()}`,
      detectedType: type,
    };
  }
}

// ============================================================
// MULTI-DB CRUD ADAPTER
// ============================================================

export interface CrudListOptions {
  limit: number;
  offset: number;
  filters: Record<string, any>;
  allowedCols: Set<string>;
}

/**
 * Insert record(s) into the target database (PostgreSQL, MySQL, or MongoDB).
 */
export async function multiDbInsert(
  dbType: DatabaseType,
  dbUrl: string | null | undefined,
  projectName: string,
  apiName: string,
  version: string,
  items: Record<string, any>[]
): Promise<any[]> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  const cleanVer = validateVersion(version);
  const cleanApi = validateIdentifier(apiName, 'API name');
  const tableName = `${cleanApi}_${cleanVer}`;

  if (dbType === 'mongodb' && dbUrl) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(dbUrl);
    try {
      await client.connect();
      const db = client.db(cleanProject);
      const collection = db.collection(tableName);

      const docsToInsert = items.map((item) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      await collection.insertMany(docsToInsert);
      return docsToInsert.map(({ _id, ...rest }: any) => rest);
    } finally {
      await client.close();
    }
  }

  if (dbType === 'mysql' && dbUrl) {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(dbUrl);
    try {
      const results = [];
      for (const item of items) {
        const id = item.id || crypto.randomUUID();
        const record: Record<string, any> = { ...item, id };
        const keys = Object.keys(record);
        const colList = keys.map((k) => `\`${k}\``).join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map((k) => record[k]);

        await conn.execute(
          `INSERT INTO \`${cleanProject}_${tableName}\` (${colList}) VALUES (${placeholders})`,
          values
        );
        results.push(record);
      }
      return results;
    } finally {
      await conn.end();
    }
  }

  // Default: PostgreSQL
  const results: any[] = [];
  for (const item of items) {
    const keys = Object.keys(item);
    if (keys.length === 0) {
      const q = `INSERT INTO "${cleanProject}"."${tableName}" DEFAULT VALUES RETURNING *`;
      const res = await executeRawSql(q, [], dbUrl);
      results.push(res[0]);
    } else {
      const colList = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map((k) => item[k]);

      const q = `
        INSERT INTO "${cleanProject}"."${tableName}" (${colList})
        VALUES (${placeholders})
        RETURNING *
      `;
      const res = await executeRawSql(q, values, dbUrl);
      results.push(res[0]);
    }
  }
  return results;
}

/**
 * List records from the target database with pagination and filtering.
 */
export async function multiDbList(
  dbType: DatabaseType,
  dbUrl: string | null | undefined,
  projectName: string,
  apiName: string,
  version: string,
  options: CrudListOptions
): Promise<{ data: any[]; total: number }> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  const cleanVer = validateVersion(version);
  const cleanApi = validateIdentifier(apiName, 'API name');
  const tableName = `${cleanApi}_${cleanVer}`;
  const { limit, offset, filters } = options;

  if (dbType === 'mongodb' && dbUrl) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(dbUrl);
    try {
      await client.connect();
      const db = client.db(cleanProject);
      const collection = db.collection(tableName);

      const mongoFilter: Record<string, any> = {};
      for (const [k, v] of Object.entries(filters)) {
        if (options.allowedCols.has(k)) {
          mongoFilter[k] = v;
        }
      }

      const total = await collection.countDocuments(mongoFilter);
      const rawData = await collection
        .find(mongoFilter)
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const data = rawData.map(({ _id, ...rest }: any) => rest);
      return { data, total };
    } finally {
      await client.close();
    }
  }

  if (dbType === 'mysql' && dbUrl) {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(dbUrl);
    try {
      const whereClauses: string[] = [];
      const values: any[] = [];
      for (const [k, v] of Object.entries(filters)) {
        if (options.allowedCols.has(k)) {
          whereClauses.push(`\`${k}\` = ?`);
          values.push(v);
        }
      }
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const [countRows]: any = await conn.execute(
        `SELECT COUNT(*) as total FROM \`${cleanProject}_${tableName}\` ${whereSql}`,
        values
      );
      const total = countRows[0]?.total || 0;

      const [dataRows]: any = await conn.execute(
        `SELECT * FROM \`${cleanProject}_${tableName}\` ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      );

      return { data: dataRows, total };
    } finally {
      await conn.end();
    }
  }

  // Default: PostgreSQL
  const whereClauses: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  for (const [k, v] of Object.entries(filters)) {
    if (options.allowedCols.has(k)) {
      whereClauses.push(`"${k}" = $${paramIdx++}`);
      values.push(v);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countQuery = `SELECT COUNT(*)::int AS total FROM "${cleanProject}"."${tableName}" ${whereSql}`;
  const countResult = await executeRawSql(countQuery, values, dbUrl);
  const total = countResult[0]?.total || 0;

  const dataQuery = `
    SELECT * FROM "${cleanProject}"."${tableName}"
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;
  const data = await executeRawSql(dataQuery, [...values, limit, offset], dbUrl);

  return { data, total };
}

/**
 * Get record by ID.
 */
export async function multiDbGetById(
  dbType: DatabaseType,
  dbUrl: string | null | undefined,
  projectName: string,
  apiName: string,
  version: string,
  id: string
): Promise<any | null> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  const cleanVer = validateVersion(version);
  const cleanApi = validateIdentifier(apiName, 'API name');
  const tableName = `${cleanApi}_${cleanVer}`;

  if (dbType === 'mongodb' && dbUrl) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(dbUrl);
    try {
      await client.connect();
      const doc = await client.db(cleanProject).collection(tableName).findOne({ id });
      if (!doc) return null;
      const { _id, ...rest } = doc as any;
      return rest;
    } finally {
      await client.close();
    }
  }

  if (dbType === 'mysql' && dbUrl) {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(dbUrl);
    try {
      const [rows]: any = await conn.execute(
        `SELECT * FROM \`${cleanProject}_${tableName}\` WHERE id = ? LIMIT 1`,
        [id]
      );
      return rows[0] || null;
    } finally {
      await conn.end();
    }
  }

  // Default: PostgreSQL
  const query = `SELECT * FROM "${cleanProject}"."${tableName}" WHERE id = $1 LIMIT 1`;
  const rows = await executeRawSql(query, [id], dbUrl);
  return rows[0] || null;
}

/**
 * Update record by ID.
 */
export async function multiDbUpdate(
  dbType: DatabaseType,
  dbUrl: string | null | undefined,
  projectName: string,
  apiName: string,
  version: string,
  id: string,
  validatedData: Record<string, any>
): Promise<any | null> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  const cleanVer = validateVersion(version);
  const cleanApi = validateIdentifier(apiName, 'API name');
  const tableName = `${cleanApi}_${cleanVer}`;

  if (dbType === 'mongodb' && dbUrl) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(dbUrl);
    try {
      await client.connect();
      const col = client.db(cleanProject).collection(tableName);
      await col.updateOne(
        { id },
        {
          $set: {
            ...validatedData,
            updated_at: new Date().toISOString(),
          },
        }
      );
      const updated = await col.findOne({ id });
      if (!updated) return null;
      const { _id, ...rest } = updated as any;
      return rest;
    } finally {
      await client.close();
    }
  }

  if (dbType === 'mysql' && dbUrl) {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(dbUrl);
    try {
      const keys = Object.keys(validatedData);
      const setClauses = keys.map((k) => `\`${k}\` = ?`).join(', ');
      const values = keys.map((k) => validatedData[k]);

      await conn.execute(
        `UPDATE \`${cleanProject}_${tableName}\` SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
        [...values, id]
      );
      const [rows]: any = await conn.execute(
        `SELECT * FROM \`${cleanProject}_${tableName}\` WHERE id = ? LIMIT 1`,
        [id]
      );
      return rows[0] || null;
    } finally {
      await conn.end();
    }
  }

  // Default: PostgreSQL
  const keys = Object.keys(validatedData);
  const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  const values = keys.map((k) => validatedData[k]);
  values.push(id);

  const query = `
    UPDATE "${cleanProject}"."${tableName}"
    SET ${setClauses}, updated_at = now()
    WHERE id = $${values.length}
    RETURNING *
  `;
  const rows = await executeRawSql(query, values, dbUrl);
  return rows[0] || null;
}

/**
 * Delete record by ID.
 */
export async function multiDbDelete(
  dbType: DatabaseType,
  dbUrl: string | null | undefined,
  projectName: string,
  apiName: string,
  version: string,
  id: string
): Promise<boolean> {
  const cleanProject = validateIdentifier(projectName, 'Project name');
  const cleanVer = validateVersion(version);
  const cleanApi = validateIdentifier(apiName, 'API name');
  const tableName = `${cleanApi}_${cleanVer}`;

  if (dbType === 'mongodb' && dbUrl) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(dbUrl);
    try {
      await client.connect();
      const res = await client.db(cleanProject).collection(tableName).deleteOne({ id });
      return res.deletedCount > 0;
    } finally {
      await client.close();
    }
  }

  if (dbType === 'mysql' && dbUrl) {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(dbUrl);
    try {
      const [res]: any = await conn.execute(
        `DELETE FROM \`${cleanProject}_${tableName}\` WHERE id = ?`,
        [id]
      );
      return res.affectedRows > 0;
    } finally {
      await conn.end();
    }
  }

  // Default: PostgreSQL
  const query = `DELETE FROM "${cleanProject}"."${tableName}" WHERE id = $1 RETURNING id`;
  const rows = await executeRawSql(query, [id], dbUrl);
  return rows.length > 0;
}
