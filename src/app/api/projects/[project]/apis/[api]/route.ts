import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';
import { dropApiTable } from '@/lib/project-db';
import { validateIdentifier, validateVersion } from '@/lib/validators';

interface Params {
  params: Promise<{ project: string; api: string }>;
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { project: projectName, api: apiName } = await params;
    const url = new URL(request.url);
    const versionQuery = url.searchParams.get('version') || 'v1';

    const cleanProject = validateIdentifier(projectName, 'Project name');
    const cleanApi = validateIdentifier(apiName, 'API name');
    const cleanVer = validateVersion(versionQuery);

    const projects = await sql<
      { id: string; name: string; database_url: string | null }[]
    >`
      SELECT id, name, database_url FROM projects
      WHERE name = ${cleanProject} AND user_id = ${auth.userId}
      LIMIT 1
    `;

    if (!projects || projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // Find the API
    const existing = await sql<
      { id: string }[]
    >`
      SELECT id FROM apis
      WHERE project_id = ${project.id} AND name = ${cleanApi} AND version = ${cleanVer}
      LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json(
        { error: `API "${cleanApi}" (${cleanVer}) not found in project "${cleanProject}"` },
        { status: 404 }
      );
    }

    // Drop table in project schema (default or external)
    await dropApiTable(cleanProject, cleanApi, cleanVer, project.database_url);

    // Delete api record
    await sql`DELETE FROM apis WHERE id = ${existing[0].id}`;

    return NextResponse.json({
      message: `API "${cleanApi}" (${cleanVer}) dropped successfully.`,
    });
  } catch (error: any) {
    console.error('Delete API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete API' },
      { status: 500 }
    );
  }
}

