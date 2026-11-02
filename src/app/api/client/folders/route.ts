import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { collection_id, name, parent_folder_id = null, sort_order = 0 } = body;

    if (!collection_id || !name) {
      return NextResponse.json(
        { error: "collection_id and name are required" },
        { status: 400 }
      );
    }

    // Verify ownership of collection
    const owns = await executeRawSql(
      `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
      [collection_id, auth.userId]
    );
    if (owns.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const created = await executeRawSql(
      `INSERT INTO folders (collection_id, parent_folder_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [collection_id, parent_folder_id, name.trim(), sort_order]
    );

    return NextResponse.json({ folder: created[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

