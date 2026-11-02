import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const body = await request.json();
    const { name, sort_order } = body;

    const existing = await executeRawSql(
      `SELECT f.id 
       FROM folders f
       JOIN collections c ON f.collection_id = c.id
       WHERE f.id = $1 AND c.user_id = $2`,
      [id, auth.userId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const updated = await executeRawSql(
      `UPDATE folders
       SET name = COALESCE($1, name),
           sort_order = COALESCE($2, sort_order)
       WHERE id = $3
       RETURNING *`,
      [name?.trim() || null, sort_order ?? null, id]
    );

    return NextResponse.json({ folder: updated[0] });
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
      `DELETE FROM folders f
       USING collections c
       WHERE f.collection_id = c.id AND f.id = $1 AND c.user_id = $2
       RETURNING f.id`,
      [id, auth.userId]
    );

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

