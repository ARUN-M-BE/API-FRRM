import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";
import {
  importPostmanCollection,
  importCurl,
  importOpenApi,
  ImportResult,
} from "@/lib/importers";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { type, data, project_id = null } = body;

    if (!type || !data) {
      return NextResponse.json({ error: "Type and data are required" }, { status: 400 });
    }

    let parsed: ImportResult;
    if (type === "postman") {
      const json = typeof data === "string" ? JSON.parse(data) : data;
      parsed = importPostmanCollection(json);
    } else if (type === "curl") {
      const curlStr = typeof data === "string" ? data : String(data);
      const req = importCurl(curlStr);
      parsed = {
        name: req.name || "Imported cURL",
        description: "Imported from cURL command",
        folders: [],
        requests: [req],
      };
    } else if (type === "openapi") {
      const json = typeof data === "string" ? JSON.parse(data) : data;
      parsed = importOpenApi(json);
    } else {
      return NextResponse.json({ error: `Unsupported import type: ${type}` }, { status: 400 });
    }

    let actualProjectId = null;
    if (project_id) {
      const pRow = await executeRawSql(
        `SELECT id FROM projects WHERE (id::text = $1 OR name = $1) AND user_id = $2`,
        [project_id, auth.userId]
      );
      if (pRow.length > 0) actualProjectId = pRow[0].id;
    }

    // Create Collection
    const colRows = await executeRawSql(
      `INSERT INTO collections (user_id, project_id, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [auth.userId, actualProjectId, parsed.name, parsed.description || ""]
    );
    const collection = colRows[0];

    // Create Folders
    const folderIdMap = new Map<string, string>();
    for (let i = 0; i < parsed.folders.length; i++) {
      const fName = parsed.folders[i];
      const fRow = await executeRawSql(
        `INSERT INTO folders (collection_id, name, sort_order)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [collection.id, fName, i]
      );
      if (fRow.length > 0) folderIdMap.set(fName, fRow[0].id);
    }

    // Create Requests
    for (let i = 0; i < parsed.requests.length; i++) {
      const req = parsed.requests[i];
      const folderId = req.folder ? folderIdMap.get(req.folder) || null : null;

      await executeRawSql(
        `INSERT INTO requests (
          collection_id, folder_id, name, method, url,
          params, headers, auth_type, auth_config,
          body_type, body_content, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          collection.id,
          folderId,
          req.name,
          req.method,
          req.url,
          JSON.stringify(req.params || []),
          JSON.stringify(req.headers || []),
          req.auth_type || "none",
          JSON.stringify(req.auth_config || {}),
          req.body_type || "none",
          req.body_content || "",
          i,
        ]
      );
    }

    return NextResponse.json({
      collection,
      imported_folders: parsed.folders.length,
      imported_requests: parsed.requests.length,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

