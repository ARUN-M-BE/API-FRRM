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

    // Verify ownership
    const collections = await executeRawSql(
      `SELECT * FROM collections WHERE id = $1 AND user_id = $2`,
      [id, auth.userId]
    );

    if (collections.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const collection = collections[0];

    // Fetch folders
    const folders = await executeRawSql(
      `SELECT * FROM folders WHERE collection_id = $1 ORDER BY sort_order ASC, name ASC`,
      [id]
    );

    // Fetch requests
    const requests = await executeRawSql(
      `SELECT * FROM requests WHERE collection_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    return NextResponse.json({
      collection,
      folders,
      requests,
    });
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
    const { name, description } = body;

    const existing = await executeRawSql(
      `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
      [id, auth.userId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const updated = await executeRawSql(
      `UPDATE collections 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = now()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name?.trim() || null, description ?? null, id, auth.userId]
    );

    return NextResponse.json({ collection: updated[0] });
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
      `DELETE FROM collections WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, auth.userId]
    );

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

