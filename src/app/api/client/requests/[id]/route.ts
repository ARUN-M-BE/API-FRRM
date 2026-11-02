import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;

    const rows = await executeRawSql(
      `SELECT r.* 
       FROM requests r
       JOIN collections c ON r.collection_id = c.id
       WHERE r.id = $1 AND c.user_id = $2`,
      [id, auth.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ request: rows[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const body = await request.json();

    const existing = await executeRawSql(
      `SELECT r.id 
       FROM requests r
       JOIN collections c ON r.collection_id = c.id
       WHERE r.id = $1 AND c.user_id = $2`,
      [id, auth.userId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const {
      name,
      folder_id,
      method,
      url,
      params: qParams,
      headers,
      auth_type,
      auth_config,
      body_type,
      body_content,
      assertions,
      extract_rules,
      sort_order,
    } = body;

    const updated = await executeRawSql(
      `UPDATE requests
       SET name = COALESCE($1, name),
           folder_id = CASE WHEN $2::text IS NOT NULL THEN $2::uuid ELSE folder_id END,
           method = COALESCE($3, method),
           url = COALESCE($4, url),
           params = CASE WHEN $5::text IS NOT NULL THEN $5::jsonb ELSE params END,
           headers = CASE WHEN $6::text IS NOT NULL THEN $6::jsonb ELSE headers END,
           auth_type = COALESCE($7, auth_type),
           auth_config = CASE WHEN $8::text IS NOT NULL THEN $8::jsonb ELSE auth_config END,
           body_type = COALESCE($9, body_type),
           body_content = COALESCE($10, body_content),
           assertions = CASE WHEN $11::text IS NOT NULL THEN $11::jsonb ELSE assertions END,
           extract_rules = CASE WHEN $12::text IS NOT NULL THEN $12::jsonb ELSE extract_rules END,
           sort_order = COALESCE($13, sort_order),
           updated_at = now()
       WHERE id = $14
       RETURNING *`,
      [
        name ?? null,
        folder_id !== undefined ? folder_id : null,
        method ? method.toUpperCase() : null,
        url ?? null,
        qParams !== undefined ? JSON.stringify(qParams) : null,
        headers !== undefined ? JSON.stringify(headers) : null,
        auth_type ?? null,
        auth_config !== undefined ? JSON.stringify(auth_config) : null,
        body_type ?? null,
        body_content ?? null,
        assertions !== undefined ? JSON.stringify(assertions) : null,
        extract_rules !== undefined ? JSON.stringify(extract_rules) : null,
        sort_order !== undefined ? sort_order : null,
        id,
      ]
    );

    return NextResponse.json({ request: updated[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;

    const deleted = await executeRawSql(
      `DELETE FROM requests r
       USING collections c
       WHERE r.collection_id = c.id AND r.id = $1 AND c.user_id = $2
       RETURNING r.id`,
      [id, auth.userId]
    );

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

