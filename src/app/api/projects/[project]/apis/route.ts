import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';
import { validateIdentifier, validateVersion, validateColumns, ValidationError } from '@/lib/validators';
import { createApiTable } from '@/lib/project-db';

interface Params {
  params: Promise<{ project: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { project: projectName } = await params;

    const projects = await sql<
      { id: string; name: string; database_url: string | null }[]
    >`
      SELECT id, name, database_url FROM projects
      WHERE name = ${projectName} AND user_id = ${auth.userId}
      LIMIT 1
    `;

    if (!projects || projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];
    const body = await request.json();
    const { name, version = 'v1', columns, check_url } = body;

    const cleanApiName = validateIdentifier(name, 'API name');
    const cleanVersion = validateVersion(version);
    const validColumns = validateColumns(columns);
    const checkUrl = check_url ? String(check_url).trim() : null;

    // Check if this API + version already exists for the project
    const existing = await sql<
      { id: string }[]
    >`
      SELECT id FROM apis
      WHERE project_id = ${project.id} AND name = ${cleanApiName} AND version = ${cleanVersion}
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `API "${cleanApiName}" (${cleanVersion}) already exists in project "${projectName}".` },
        { status: 409 }
      );
    }

    // Create table in project schema (default or external db)
    await createApiTable(project.name, cleanApiName, cleanVersion, validColumns, project.database_url);

    // Insert API record
    const inserted = await sql<
      {
        id: string;
        name: string;
        version: string;
        columns: any;
        check_url: string | null;
        created_at: string;
      }[]
    >`
      INSERT INTO apis (project_id, name, version, columns, check_url)
      VALUES (${project.id}, ${cleanApiName}, ${cleanVersion}, ${JSON.stringify(validColumns)}, ${checkUrl})
      RETURNING id, name, version, columns, check_url, created_at
    `;

    return NextResponse.json(
      {
        message: 'API created successfully',
        api: inserted[0],
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    console.error('Create API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create API' },
      { status: 500 }
    );
  }
}

