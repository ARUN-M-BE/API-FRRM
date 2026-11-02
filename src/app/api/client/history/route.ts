import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const method = searchParams.get("method");
    const collectionId = searchParams.get("collection_id");

    let query = `SELECT * FROM request_history WHERE user_id = $1`;
    const params: (string | number)[] = [auth.userId];

    if (method) {
      query += ` AND method = $${params.length + 1}`;
      params.push(method.toUpperCase());
    }

    if (collectionId) {
      query += ` AND collection_id = $${params.length + 1}`;
      params.push(collectionId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const history = await executeRawSql(query, params);
    return NextResponse.json({ history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const before = searchParams.get("before");

    if (before) {
      await executeRawSql(
        `DELETE FROM request_history WHERE user_id = $1 AND created_at < $2::timestamptz`,
        [auth.userId, before]
      );
    } else {
      await executeRawSql(
        `DELETE FROM request_history WHERE user_id = $1`,
        [auth.userId]
      );
    }

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

