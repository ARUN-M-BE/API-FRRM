import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    let query = `
      SELECT c.*, 
        COUNT(r.id)::int AS request_count
      FROM collections c
      LEFT JOIN requests r ON r.collection_id = c.id
      WHERE c.user_id = $1
    `;
    const params: (string | null)[] = [auth.userId];

    if (projectId) {
      // Lookup project ID from project name or UUID
      const projectRow = await executeRawSql(
        `SELECT id FROM projects WHERE (id::text = $1 OR name = $1) AND user_id = $2`,
        [projectId, auth.userId]
      );
      if (projectRow.length > 0) {
        query += ` AND c.project_id = $2`;
        params.push(projectRow[0].id);
      } else {
        query += ` AND c.project_id IS NULL`;
      }
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const collections = await executeRawSql(query, params);
    return NextResponse.json({ collections });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { name, description = "", project_id = null } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Collection name is required" }, { status: 400 });
    }

    let actualProjectId = null;
    if (project_id) {
      const pRow = await executeRawSql(
        `SELECT id FROM projects WHERE (id::text = $1 OR name = $1) AND user_id = $2`,
        [project_id, auth.userId]
      );
      if (pRow.length > 0) actualProjectId = pRow[0].id;
    }

    const created = await executeRawSql(
      `INSERT INTO collections (user_id, project_id, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [auth.userId, actualProjectId, name.trim(), description]
    );

    return NextResponse.json({ collection: created[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

