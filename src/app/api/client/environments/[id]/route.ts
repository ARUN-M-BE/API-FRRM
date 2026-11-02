import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";
import { encryptValue, maskSecret } from "@/lib/encryption";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;

    const envs = await executeRawSql(
      `SELECT * FROM environments WHERE id = $1 AND user_id = $2`,
      [id, auth.userId]
    );

    if (envs.length === 0) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    const env = envs[0];
    const vars = Array.isArray(env.variables)
      ? env.variables.map((v: { key: string; value: string; is_secret?: boolean; encrypted_value?: string }) => ({
          key: v.key,
          value: v.is_secret ? maskSecret(v.value || "") : v.value,
          is_secret: !!v.is_secret,
        }))
      : [];

    return NextResponse.json({ environment: { ...env, variables: vars } });
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
    const { name, variables } = body;

    const existing = await executeRawSql(
      `SELECT * FROM environments WHERE id = $1 AND user_id = $2`,
      [id, auth.userId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    let processedVars = existing[0].variables;
    if (Array.isArray(variables)) {
      processedVars = [];
      for (const v of variables) {
        if (!v.key) continue;
        if (v.is_secret) {
          // If value is already masked and not changed, keep previous encrypted_value
          const prev = existing[0].variables?.find((pv: { key: string }) => pv.key === v.key);
          if (v.value && v.value.includes("•••") && prev?.encrypted_value) {
            processedVars.push(prev);
          } else {
            const encrypted = await encryptValue(v.value || "");
            processedVars.push({
              key: v.key,
              value: v.value || "",
              encrypted_value: encrypted,
              is_secret: true,
            });
          }
        } else {
          processedVars.push({
            key: v.key,
            value: v.value || "",
            is_secret: false,
          });
        }
      }
    }

    const updated = await executeRawSql(
      `UPDATE environments 
       SET name = COALESCE($1, name),
           variables = $2,
           updated_at = now()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name?.trim() || null, JSON.stringify(processedVars), id, auth.userId]
    );

    return NextResponse.json({ environment: updated[0] });
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
      `DELETE FROM environments WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, auth.userId]
    );

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

