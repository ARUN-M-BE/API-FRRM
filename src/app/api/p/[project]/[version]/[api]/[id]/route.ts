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
    id: string;
  }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: Params) {
  try {
    const { project: projectName, version, api: apiName, id } = await params;

    const auth = await requireProjectApiKey(request, projectName);
    if (auth instanceof NextResponse) return auth;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid record ID format. Expected UUID.' }, { status: 400 });
    }

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');
    const tableName = getTableName(cleanApi, cleanVer);

    const query = `SELECT * FROM "${cleanProject}"."${tableName}" WHERE id = $1 LIMIT 1`;
    const rows = await executeRawSql(query, [id]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('CRUD GET by ID error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { project: projectName, version, api: apiName, id } = await params;

    const auth = await requireProjectApiKey(request, projectName);
    if (auth instanceof NextResponse) return auth;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid record ID format. Expected UUID.' }, { status: 400 });
    }

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');
    const tableName = getTableName(cleanApi, cleanVer);

    // Fetch API column definitions
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

    const columnDefs = apis[0].columns;
    const body = await request.json();

    // Full validation: missing optional fields become null
    const validated = validateBody(body, columnDefs, false);

    // Build update set statement: all user columns replaced
    const setClauses: string[] = ['"updated_at" = now()'];
    const values: any[] = [];
    let idx = 1;

    for (const col of columnDefs) {
      setClauses.push(`"${col.name}" = $${idx++}`);
      values.push(validated[col.name] ?? null);
    }

    values.push(id);
    const query = `
      UPDATE "${cleanProject}"."${tableName}"
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

    const updated = await executeRawSql(query, values);
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    console.error('CRUD PUT error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { project: projectName, version, api: apiName, id } = await params;

    const auth = await requireProjectApiKey(request, projectName);
    if (auth instanceof NextResponse) return auth;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid record ID format. Expected UUID.' }, { status: 400 });
    }

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');
    const tableName = getTableName(cleanApi, cleanVer);

    // Fetch API column definitions
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

    const columnDefs = apis[0].columns;
    const body = await request.json();

    // Partial validation: missing fields allowed
    const validated = validateBody(body, columnDefs, true);
    const keys = Object.keys(validated);

    if (keys.length === 0) {
      return NextResponse.json({ error: 'No fields provided to update.' }, { status: 400 });
    }

    const setClauses: string[] = ['"updated_at" = now()'];
    const values: any[] = [];
    let idx = 1;

    for (const key of keys) {
      setClauses.push(`"${key}" = $${idx++}`);
      values.push(validated[key]);
    }

    values.push(id);
    const query = `
      UPDATE "${cleanProject}"."${tableName}"
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

    const updated = await executeRawSql(query, values);
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    console.error('CRUD PATCH error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { project: projectName, version, api: apiName, id } = await params;

    const auth = await requireProjectApiKey(request, projectName);
    if (auth instanceof NextResponse) return auth;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid record ID format. Expected UUID.' }, { status: 400 });
    }

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');
    const tableName = getTableName(cleanApi, cleanVer);

    const query = `DELETE FROM "${cleanProject}"."${tableName}" WHERE id = $1 RETURNING id`;
    const deleted = await executeRawSql(query, [id]);

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('CRUD DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

