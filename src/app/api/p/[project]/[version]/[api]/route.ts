import { NextResponse } from 'next/server';
import { sql, executeRawSql } from '@/lib/db';
import { requireProjectApiKey } from '@/lib/middleware';
import { validateIdentifier, validateVersion, validateBody, ValidationError } from '@/lib/validators';
import { ColumnDefinition } from '@/lib/schemas';
import { getTableName } from '@/lib/project-db';

interface Params {
  params: Promise<{
    project: string;
    version: string;
    api: string;
  }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { project: projectName, version, api: apiName } = await params;

    const auth = await requireProjectApiKey(request, projectName);
    if (auth instanceof NextResponse) return auth;

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');
    const tableName = getTableName(cleanApi, cleanVer);

    // Fetch API definition
    const apis = await sql<
      { id: string; columns: ColumnDefinition[] }[]
    >`
      SELECT a.id, a.columns
      FROM apis a
      WHERE a.project_id = ${auth.project.id} AND a.name = ${cleanApi} AND a.version = ${cleanVer}
      LIMIT 1
    `;

    if (!apis || apis.length === 0) {
      return NextResponse.json(
        { error: `API "${cleanApi}" (${cleanVer}) not found in project "${cleanProject}"` },
        { status: 404 }
      );
    }

    const columnDefs: ColumnDefinition[] = apis[0].columns;
    const body = await request.json();

    const isArray = Array.isArray(body);
    const items = isArray ? body : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: 'Body array cannot be empty' }, { status: 400 });
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Maximum batch size is 100 items' }, { status: 400 });
    }

    // Validate each item
    const validatedItems = items.map((item, idx) => {
      try {
        return validateBody(item, columnDefs, false);
      } catch (err: any) {
        throw new ValidationError(`Item at index ${idx}: ${err.message}`, 422, err.details);
      }
    });

    const results: any[] = [];

    // Insert records
    for (const item of validatedItems) {
      const keys = Object.keys(item);
      if (keys.length === 0) {
        // Default insert
        const q = `INSERT INTO "${cleanProject}"."${tableName}" DEFAULT VALUES RETURNING *`;
        const res = await executeRawSql(q, [], auth.project.database_url);
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
        const res = await executeRawSql(q, values, auth.project.database_url);
        results.push(res[0]);
      }
    }

    return NextResponse.json(isArray ? results : results[0], { status: 201 });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    console.error('CRUD POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { project: projectName, version, api: apiName } = await params;

    const auth = await requireProjectApiKey(request, projectName);
    if (auth instanceof NextResponse) return auth;

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');
    const tableName = getTableName(cleanApi, cleanVer);

    // Fetch API definition to know columns
    const apis = await sql<
      { id: string; columns: ColumnDefinition[] }[]
    >`
      SELECT a.id, a.columns
      FROM apis a
      WHERE a.project_id = ${auth.project.id} AND a.name = ${cleanApi} AND a.version = ${cleanVer}
      LIMIT 1
    `;

    if (!apis || apis.length === 0) {
      return NextResponse.json(
        { error: `API "${cleanApi}" (${cleanVer}) not found in project "${cleanProject}"` },
        { status: 404 }
      );
    }

    const columnDefs: ColumnDefinition[] = apis[0].columns;
    const allowedCols = new Set(['id', 'created_at', 'updated_at', ...columnDefs.map((c) => c.name)]);

    const url = new URL(request.url);
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const offsetParam = parseInt(url.searchParams.get('offset') || '0', 10);

    const limit = Math.max(1, Math.min(isNaN(limitParam) ? 50 : limitParam, 100));
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    // Build filter clauses
    const whereClauses: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    url.searchParams.forEach((val, key) => {
      if (key !== 'limit' && key !== 'offset' && allowedCols.has(key)) {
        whereClauses.push(`"${key}" = $${paramIdx++}`);
        values.push(val);
      }
    });

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count query
    const countQuery = `SELECT COUNT(*)::int AS total FROM "${cleanProject}"."${tableName}" ${whereSql}`;
    const countResult = await executeRawSql(countQuery, values, auth.project.database_url);
    const total = countResult[0]?.total || 0;

    // Data query
    const dataQuery = `
      SELECT * FROM "${cleanProject}"."${tableName}"
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    const data = await executeRawSql(dataQuery, [...values, limit, offset], auth.project.database_url);

    return NextResponse.json({
      data,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('CRUD GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

