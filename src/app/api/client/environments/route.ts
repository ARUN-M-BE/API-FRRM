import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";
import { encryptValue, maskSecret } from "@/lib/encryption";

interface VariableInput {
  key: string;
  value: string;
  is_secret?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    let query = `SELECT * FROM environments WHERE user_id = $1`;
    const params: (string | null)[] = [auth.userId];

    if (projectId) {
      const pRow = await executeRawSql(
        `SELECT id FROM projects WHERE (id::text = $1 OR name = $1) AND user_id = $2`,
        [projectId, auth.userId]
      );
      if (pRow.length > 0) {
        query += ` AND (project_id = $2 OR project_id IS NULL)`;
        params.push(pRow[0].id);
      }
    }

    query += ` ORDER BY created_at ASC`;

    const envs = await executeRawSql(query, params);

    // Mask secret values in response
    const maskedEnvs = envs.map((env) => {
      const vars = Array.isArray(env.variables)
        ? env.variables.map((v: { key: string; value: string; is_secret?: boolean; encrypted_value?: string }) => ({
            key: v.key,
            value: v.is_secret ? maskSecret(v.value || "") : v.value,
            is_secret: !!v.is_secret,
          }))
        : [];
      return { ...env, variables: vars };
    });

    return NextResponse.json({ environments: maskedEnvs });
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
    const { name, project_id = null, variables = [] } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Environment name is required" }, { status: 400 });
    }

    let actualProjectId = null;
    if (project_id) {
      const pRow = await executeRawSql(
        `SELECT id FROM projects WHERE (id::text = $1 OR name = $1) AND user_id = $2`,
        [project_id, auth.userId]
      );
      if (pRow.length > 0) actualProjectId = pRow[0].id;
    }

    // Process variables, encrypt secrets with AES-GCM
    const processedVars = [];
    for (const v of variables as VariableInput[]) {
      if (!v.key) continue;
      if (v.is_secret) {
        const encrypted = await encryptValue(v.value || "");
        processedVars.push({
          key: v.key,
          value: v.value || "", // plain stored in encrypted form
          encrypted_value: encrypted,
          is_secret: true,
        });
      } else {
        processedVars.push({
          key: v.key,
          value: v.value || "",
          is_secret: false,
        });
      }
    }

    const created = await executeRawSql(
      `INSERT INTO environments (user_id, project_id, name, variables)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [auth.userId, actualProjectId, name.trim(), JSON.stringify(processedVars)]
    );

    return NextResponse.json({ environment: created[0] }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

