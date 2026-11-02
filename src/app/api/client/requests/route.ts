import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collection_id");
    const folderId = searchParams.get("folder_id");

    if (!collectionId) {
      return NextResponse.json({ error: "collection_id is required" }, { status: 400 });
    }

    // Verify user owns collection
    const owns = await executeRawSql(
      `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
      [collectionId, auth.userId]
    );
    if (owns.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    let query = `SELECT * FROM requests WHERE collection_id = $1`;
    const params: (string | null)[] = [collectionId];

    if (folderId) {
      query += ` AND folder_id = $2`;
      params.push(folderId);
    }

    query += ` ORDER BY sort_order ASC, created_at ASC`;

    const requests = await executeRawSql(query, params);
    return NextResponse.json({ requests });
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
    const {
      collection_id,
      folder_id = null,
      name,
      method = "GET",
      url = "",
      params = [],
      headers = [],
      auth_type = "none",
      auth_config = {},
      body_type = "none",
      body_content = "",
      assertions = [],
      extract_rules = [],
      sort_order = 0,
    } = body;

    if (!collection_id || !name) {
      return NextResponse.json(
        { error: "collection_id and name are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const owns = await executeRawSql(
      `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
      [collection_id, auth.userId]
    );
    if (owns.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const created = await executeRawSql(
      `INSERT INTO requests (
        collection_id, folder_id, name, method, url,
        params, headers, auth_type, auth_config,
        body_type, body_content, assertions, extract_rules, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        collection_id,
        folder_id,
        name.trim(),
        method.toUpperCase(),
        url,
        JSON.stringify(params),
        JSON.stringify(headers),
        auth_type,
        JSON.stringify(auth_config),
        body_type,
        body_content,
        JSON.stringify(assertions),
        JSON.stringify(extract_rules),
        sort_order,
      ]
    );

    return NextResponse.json({ request: created[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

