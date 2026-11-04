import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireProjectApiKey } from '@/lib/middleware';
import { validateIdentifier, validateVersion, validateBody, ValidationError } from '@/lib/validators';
import { ColumnDefinition } from '@/lib/schemas';
import { multiDbInsert, multiDbList } from '@/lib/multi-db';

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

    // Multi-DB insert (PostgreSQL, MySQL, or MongoDB)
    const results = await multiDbInsert(
      auth.project.database_type,
      auth.project.database_url,
      cleanProject,
      cleanApi,
      cleanVer,
      validatedItems
    );

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

    // Fetch API definition to know allowed columns
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

    const filters: Record<string, any> = {};
    url.searchParams.forEach((val, key) => {
      if (key !== 'limit' && key !== 'offset' && allowedCols.has(key)) {
        filters[key] = val;
      }
    });

    const { data, total } = await multiDbList(
      auth.project.database_type,
      auth.project.database_url,
      cleanProject,
      cleanApi,
      cleanVer,
      {
        limit,
        offset,
        filters,
        allowedCols,
      }
    );

    return NextResponse.json({
      data,
      total,
      limit,
      offset,
      database_type: auth.project.database_type,
    });
  } catch (error: any) {
    console.error('CRUD GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
