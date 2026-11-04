import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';
import { testMultiDbConnection, DatabaseType, detectDatabaseType } from '@/lib/multi-db';
import { dropProjectSchema, createProjectSchema, createApiTable } from '@/lib/project-db';
import { generateApiKey } from '@/lib/api-key';

interface Params {
  params: Promise<{ project: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { project: projectName } = await params;

    const projects = await sql<
      { id: string; name: string; api_key: string; database_url: string | null; database_type: string; created_at: string }[]
    >`
      SELECT id, name, api_key, database_url, COALESCE(database_type, 'postgres') AS database_type, created_at
      FROM projects
      WHERE name = ${projectName} AND user_id = ${auth.userId}
      LIMIT 1
    `;

    if (!projects || projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // Fetch APIs
    const apis = await sql<
      {
        id: string;
        name: string;
        version: string;
        columns: any;
        check_url: string | null;
        is_up: boolean;
        last_checked_at: string | null;
        created_at: string;
      }[]
    >`
      SELECT id, name, version, columns, check_url, is_up, last_checked_at, created_at
      FROM apis
      WHERE project_id = ${project.id}
      ORDER BY name ASC, version ASC
    `;

    // Fetch Notification channels
    const channels = await sql<
      { id: string; type: string; target: string; created_at: string }[]
    >`
      SELECT id, type, target, created_at
      FROM notify_channels
      WHERE project_id = ${project.id}
      ORDER BY created_at ASC
    `;

    // Fetch recent check history for latency charts (last 24h checks)
    const checks = await sql<
      { id: string; api_id: string; status_code: number; latency_ms: number; checked_at: string }[]
    >`
      SELECT c.id, c.api_id, c.status_code, c.latency_ms, c.checked_at
      FROM api_checks c
      JOIN apis a ON a.id = c.api_id
      WHERE a.project_id = ${project.id}
      ORDER BY c.checked_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      project: {
        ...project,
        apis,
        channels,
        recentChecks: checks,
      },
    });
  } catch (error: any) {
    console.error('Get project detail error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { project: projectName } = await params;
    const body = await request.json();

    const projects = await sql<
      { id: string; name: string; database_url: string | null; database_type: string | null }[]
    >`
      SELECT id, name, database_url, database_type FROM projects WHERE name = ${projectName} AND user_id = ${auth.userId} LIMIT 1
    `;

    if (!projects || projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];
    const projectId = project.id;

    // Rotate API Key if requested
    if (body.action === 'rotate_api_key') {
      const newApiKey = generateApiKey();
      await sql`
        UPDATE projects SET api_key = ${newApiKey} WHERE id = ${projectId}
      `;
      return NextResponse.json({
        message: 'API key rotated successfully',
        api_key: newApiKey,
      });
    }

    // Update External Database Configuration
    if ('database_url' in body || 'database_type' in body) {
      const newDbUrl = body.database_url ? String(body.database_url).trim() : null;
      let newDbType = body.database_type || project.database_type || 'postgres';

      if (newDbUrl) {
        newDbType = (body.database_type as DatabaseType) || detectDatabaseType(newDbUrl);
        const testRes = await testMultiDbConnection(newDbUrl, newDbType);
        if (!testRes.success) {
          return NextResponse.json(
            { error: `Connection failed to external ${newDbType.toUpperCase()}: ${testRes.error}` },
            { status: 400 }
          );
        }

        if (newDbType === 'postgres') {
          // Initialize schema and existing API tables on new database
          try {
            await createProjectSchema(project.name, newDbUrl);
            const apis = await sql<
              { name: string; version: string; columns: any }[]
            >`SELECT name, version, columns FROM apis WHERE project_id = ${projectId}`;

            for (const api of apis) {
              await createApiTable(project.name, api.name, api.version, api.columns, newDbUrl);
            }
          } catch (tErr) {
            console.warn('Schema migration warning on external postgres:', tErr);
          }
        }
      }

      await sql`
        UPDATE projects 
        SET database_url = ${newDbUrl}, database_type = ${newDbType} 
        WHERE id = ${projectId}
      `;

      return NextResponse.json({
        message: 'Database connection updated successfully',
        database_url: newDbUrl,
        database_type: newDbType,
      });
    }

    // Add or remove notification channels
    if (body.channels && Array.isArray(body.channels)) {
      await sql`DELETE FROM notify_channels WHERE project_id = ${projectId}`;
      for (const ch of body.channels) {
        if (ch.type && ch.target) {
          await sql`
            INSERT INTO notify_channels (project_id, type, target)
            VALUES (${projectId}, ${ch.type}, ${ch.target})
          `;
        }
      }
      return NextResponse.json({ message: 'Notification channels updated' });
    }

    return NextResponse.json({ message: 'Nothing updated' });
  } catch (error: any) {
    console.error('Update project error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { project: projectName } = await params;

    const projects = await sql<
      { id: string; name: string; database_url: string | null; database_type: string | null }[]
    >`
      SELECT id, name, database_url, database_type FROM projects
      WHERE name = ${projectName} AND user_id = ${auth.userId}
      LIMIT 1
    `;

    if (!projects || projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // Drop schema in Postgres if postgres
    if (!project.database_type || project.database_type === 'postgres') {
      try {
        await dropProjectSchema(project.name, project.database_url);
      } catch (dropErr) {
        console.warn('Drop schema warning:', dropErr);
      }
    }

    // Delete project row (cascades to apis, api_checks, notify_channels)
    await sql`DELETE FROM projects WHERE id = ${project.id}`;

    return NextResponse.json({
      message: `Project "${project.name}" and all associated tables dropped successfully.`,
    });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete project' },
      { status: 500 }
    );
  }
}
