import { NextResponse } from 'next/server';
import { getSessionUserId } from './session';
import { sql } from './db';
import { verifyApiKey } from './api-key';

export async function requireAuth(request: Request): Promise<{ userId: string } | NextResponse> {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
  }
  return { userId };
}

export async function requireProjectApiKey(
  request: Request,
  projectName: string
): Promise<{ project: { id: string; name: string; database_url: string | null } } | NextResponse> {
  const apiKeyHeader = request.headers.get('x-api-key');
  if (!apiKeyHeader) {
    return NextResponse.json(
      { error: 'Missing x-api-key header' },
      { status: 401 }
    );
  }

  const projects = await sql<
    { id: string; name: string; api_key: string; database_url: string | null }[]
  >`SELECT id, name, api_key, database_url FROM projects WHERE name = ${projectName} LIMIT 1`;

  if (!projects || projects.length === 0) {
    return NextResponse.json(
      { error: `Project "${projectName}" not found` },
      { status: 404 }
    );
  }

  const project = projects[0];
  if (!verifyApiKey(apiKeyHeader, project.api_key)) {
    return NextResponse.json(
      { error: 'Invalid x-api-key' },
      { status: 401 }
    );
  }

  return { project: { id: project.id, name: project.name, database_url: project.database_url } };
}
