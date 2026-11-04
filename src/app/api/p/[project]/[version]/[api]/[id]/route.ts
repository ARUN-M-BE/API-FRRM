import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireProjectApiKey } from '@/lib/middleware';
import { validateIdentifier, validateVersion, validateBody, ValidationError } from '@/lib/validators';
import { ColumnDefinition } from '@/lib/schemas';
import { multiDbGetById, multiDbUpdate, multiDbDelete } from '@/lib/multi-db';

interface Params {
  params: Promise<{
    project: string;
    version: string;
    api: string;
    id: string;
  }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { project: projectName, version, api: apiName, id } = await params;

    const auth = await requireProjectApiKey(request, projectName);
    if (auth instanceof NextResponse) return auth;

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');

    const row = await multiDbGetById(
      auth.project.database_type,
      auth.project.database_url,
      cleanProject,
      cleanApi,
      cleanVer,
      id
    );

    if (!row) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(row);
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

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');

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

    // Full validation
    const validated = validateBody(body, columnDefs, false);

    const updated = await multiDbUpdate(
      auth.project.database_type,
      auth.project.database_url,
      cleanProject,
      cleanApi,
      cleanVer,
      id,
      validated
    );

    if (!updated) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
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

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');

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

    // Partial validation
    const validated = validateBody(body, columnDefs, true);
    if (Object.keys(validated).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update.' }, { status: 400 });
    }

    const updated = await multiDbUpdate(
      auth.project.database_type,
      auth.project.database_url,
      cleanProject,
      cleanApi,
      cleanVer,
      id,
      validated
    );

    if (!updated) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
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

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanVer = validateVersion(version);
    const cleanApi = validateIdentifier(apiName, 'API name');

    const success = await multiDbDelete(
      auth.project.database_type,
      auth.project.database_url,
      cleanProject,
      cleanApi,
      cleanVer,
      id
    );

    if (!success) {
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
