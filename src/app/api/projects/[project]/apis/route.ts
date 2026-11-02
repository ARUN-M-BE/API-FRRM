import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';
import { validateIdentifier, validateVersion, validateColumns, ValidationError } from '@/lib/validators';
import { createApiTable } from '@/lib/project-db';
import { encryptValue } from '@/lib/encryption';

interface Params {
  params: Promise<{ project: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { project: projectName } = await params;

    const projects = await sql<
      { id: string; name: string; api_key: string; database_url: string | null }[]
    >`
      SELECT id, name, api_key, database_url FROM projects
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

    // ============================================================
    // Auto-generate Collection with Create, List, Get, PUT, PATCH, Delete
    // ============================================================
    try {
      // 1. Ensure default project environment exists
      const existingEnvs = await sql<
        { id: string }[]
      >`
        SELECT id FROM environments WHERE project_id = ${project.id} LIMIT 1
      `;
      if (!existingEnvs || existingEnvs.length === 0) {
        const encryptedKey = await encryptValue(project.api_key);
        const defaultVars = [
          { key: 'base_url', value: 'http://localhost:3000', is_secret: false },
          { key: 'api_key', value: project.api_key, encrypted_value: encryptedKey, is_secret: true },
          { key: 'item_id', value: '', is_secret: false },
        ];
        await sql`
          INSERT INTO environments (user_id, project_id, name, variables)
          VALUES (${auth.userId}, ${project.id}, 'Default', ${JSON.stringify(defaultVars)})
        `;
      }

      // 2. Create collection
      const collectionName = `${cleanApiName} (${cleanVersion})`;
      const colRows = await sql<
        { id: string }[]
      >`
        INSERT INTO collections (user_id, project_id, name, description, auto_generated)
        VALUES (
          ${auth.userId},
          ${project.id},
          ${collectionName},
          ${`Auto-generated CRUD test suite for ${cleanApiName} ${cleanVersion}`},
          true
        )
        RETURNING id
      `;
      const collectionId = colRows[0].id;

      // 3. Build example JSON body from validColumns
      const exampleBodyObj: Record<string, any> = {};
      for (const col of validColumns) {
        if (col.type === 'int' || col.type === 'bigint') exampleBodyObj[col.name] = 1;
        else if (col.type === 'float') exampleBodyObj[col.name] = 19.99;
        else if (col.type === 'bool') exampleBodyObj[col.name] = true;
        else if (col.type === 'json') exampleBodyObj[col.name] = { key: 'value' };
        else if (col.type === 'timestamp') exampleBodyObj[col.name] = new Date().toISOString();
        else exampleBodyObj[col.name] = `Sample ${col.name}`;
      }
      const exampleBodyJson = JSON.stringify(exampleBodyObj, null, 2);

      const basePath = `{{base_url}}/api/p/${project.name}/${cleanVersion}/${cleanApiName}`;
      const defaultHeaders = [
        { key: 'x-api-key', value: '{{api_key}}', enabled: true },
        { key: 'Content-Type', value: 'application/json', enabled: true },
      ];

      // Requests definition: List, Create, Get, PUT, PATCH, Delete
      const autoRequests = [
        {
          name: '1. List All',
          method: 'GET',
          url: basePath,
          headers: defaultHeaders,
          body_type: 'none',
          body_content: '',
          assertions: [{ type: 'status', operator: 'eq', expected: 200 }],
          extract_rules: [{ json_path: 'data[0].id', variable_name: 'item_id' }],
          sort_order: 0,
        },
        {
          name: '2. Create Record',
          method: 'POST',
          url: basePath,
          headers: defaultHeaders,
          body_type: 'json',
          body_content: exampleBodyJson,
          assertions: [{ type: 'status', operator: 'eq', expected: 201 }],
          extract_rules: [{ json_path: 'data.id', variable_name: 'item_id' }],
          sort_order: 1,
        },
        {
          name: '3. Get by ID',
          method: 'GET',
          url: `${basePath}/{{item_id}}`,
          headers: defaultHeaders,
          body_type: 'none',
          body_content: '',
          assertions: [{ type: 'status', operator: 'eq', expected: 200 }],
          extract_rules: [],
          sort_order: 2,
        },
        {
          name: '4. Update (Full PUT)',
          method: 'PUT',
          url: `${basePath}/{{item_id}}`,
          headers: defaultHeaders,
          body_type: 'json',
          body_content: exampleBodyJson,
          assertions: [{ type: 'status', operator: 'eq', expected: 200 }],
          extract_rules: [],
          sort_order: 3,
        },
        {
          name: '5. Update (Partial PATCH)',
          method: 'PATCH',
          url: `${basePath}/{{item_id}}`,
          headers: defaultHeaders,
          body_type: 'json',
          body_content: JSON.stringify(
            validColumns.length > 0 ? { [validColumns[0].name]: 'Updated Value' } : {},
            null,
            2
          ),
          assertions: [{ type: 'status', operator: 'eq', expected: 200 }],
          extract_rules: [],
          sort_order: 4,
        },
        {
          name: '6. Delete Record',
          method: 'DELETE',
          url: `${basePath}/{{item_id}}`,
          headers: defaultHeaders,
          body_type: 'none',
          body_content: '',
          assertions: [{ type: 'status', operator: 'eq', expected: 204 }],
          extract_rules: [],
          sort_order: 5,
        },
      ];

      for (const req of autoRequests) {
        await sql`
          INSERT INTO requests (
            collection_id, name, method, url, headers, params,
            auth_type, auth_config, body_type, body_content,
            assertions, extract_rules, sort_order
          ) VALUES (
            ${collectionId},
            ${req.name},
            ${req.method},
            ${req.url},
            ${JSON.stringify(req.headers)},
            '[]',
            'none',
            '{}',
            ${req.body_type},
            ${req.body_content},
            ${JSON.stringify(req.assertions)},
            ${JSON.stringify(req.extract_rules)},
            ${req.sort_order}
          )
        `;
      }
    } catch (colErr) {
      console.error('Failed to auto-generate collection:', colErr);
      // Non-fatal: the API was still created
    }

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
