import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';
import { validateIdentifier, validateVersion, validateColumns, ValidationError } from '@/lib/validators';
import { generateApiKey } from '@/lib/api-key';
import { createProjectSchema, createApiTable } from '@/lib/project-db';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const projects = await sql<
      {
        id: string;
        name: string;
        api_key: string;
        created_at: string;
        api_count: number;
      }[]
    >`
      SELECT p.id, p.name, p.api_key, p.created_at,
             COUNT(a.id)::int AS api_count
      FROM projects p
      LEFT JOIN apis a ON a.project_id = p.id
      WHERE p.user_id = ${auth.userId}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('List projects error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to list projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, apis = [], notify_channels = [] } = body;

    const cleanProjectName = validateIdentifier(name, 'Project name');

    // Check if project name already exists globally
    const existing = await sql<
      { id: string }[]
    >`SELECT id FROM projects WHERE name = ${cleanProjectName} LIMIT 1`;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Project name "${cleanProjectName}" is already taken.` },
        { status: 409 }
      );
    }

    const apiKey = generateApiKey();

    // 1. Insert project
    const insertedProject = await sql<
      { id: string; name: string; api_key: string; created_at: string }[]
    >`
      INSERT INTO projects (user_id, name, api_key)
      VALUES (${auth.userId}, ${cleanProjectName}, ${apiKey})
      RETURNING id, name, api_key, created_at
    `;
    const project = insertedProject[0];

    // 2. Create schema in Postgres
    await createProjectSchema(cleanProjectName);

    // 3. Create APIs if provided
    const createdApis = [];
    if (Array.isArray(apis) && apis.length > 0) {
      for (const api of apis) {
        const cleanApiName = validateIdentifier(api.name, 'API name');
        const cleanVersion = validateVersion(api.version || 'v1');
        const validColumns = validateColumns(api.columns);
        const checkUrl = api.check_url ? String(api.check_url).trim() : null;

        // Create table in project schema
        await createApiTable(cleanProjectName, cleanApiName, cleanVersion, validColumns);

        // Record in apis table
        const insertedApi = await sql<
          { id: string; name: string; version: string; columns: any; check_url: string | null }[]
        >`
          INSERT INTO apis (project_id, name, version, columns, check_url)
          VALUES (${project.id}, ${cleanApiName}, ${cleanVersion}, ${JSON.stringify(validColumns)}, ${checkUrl})
          RETURNING id, name, version, columns, check_url
        `;
        createdApis.push(insertedApi[0]);
      }
    }

    // 4. Create Notification channels if provided
    const createdChannels = [];
    if (Array.isArray(notify_channels) && notify_channels.length > 0) {
      for (const ch of notify_channels) {
        if (!['telegram', 'slack', 'discord', 'email'].includes(ch.type)) {
          continue;
        }
        if (!ch.target || typeof ch.target !== 'string') {
          continue;
        }

        const insertedCh = await sql<
          { id: string; type: string; target: string }[]
        >`
          INSERT INTO notify_channels (project_id, type, target)
          VALUES (${project.id}, ${ch.type}, ${ch.target.trim()})
          RETURNING id, type, target
        `;
        createdChannels.push(insertedCh[0]);
      }
    }

    return NextResponse.json(
      {
        message: 'Project created successfully',
        project: {
          ...project,
          apis: createdApis,
          notify_channels: createdChannels,
        },
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
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}

