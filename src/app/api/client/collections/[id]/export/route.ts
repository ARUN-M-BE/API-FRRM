import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";
import { exportPostmanCollection, ExportRequest } from "@/lib/importers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;

    const collections = await executeRawSql(
      `SELECT * FROM collections WHERE id = $1 AND user_id = $2`,
      [id, auth.userId]
    );
    if (collections.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    const collection = collections[0];

    const folders = await executeRawSql(
      `SELECT id, name FROM folders WHERE collection_id = $1 ORDER BY sort_order ASC, name ASC`,
      [id]
    );
    const folderNames = folders.map((f) => f.name as string);
    const folderMap = new Map<string, string>();
    folders.forEach((f) => folderMap.set(f.id as string, f.name as string));

    const requests = await executeRawSql(
      `SELECT * FROM requests WHERE collection_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    const exportRequests: ExportRequest[] = requests.map((r) => ({
      name: r.name,
      method: r.method,
      url: r.url,
      headers: r.headers || [],
      params: r.params || [],
      body_type: r.body_type,
      body_content: r.body_content,
      auth_type: r.auth_type,
      auth_config: r.auth_config || {},
      folder_name: r.folder_id ? folderMap.get(r.folder_id) : undefined,
    }));

    const postmanJson = exportPostmanCollection(
      collection.name,
      collection.description || "",
      exportRequests,
      folderNames
    );

    const filename = `${collection.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.postman_collection.json`;

    return new Response(JSON.stringify(postmanJson, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

