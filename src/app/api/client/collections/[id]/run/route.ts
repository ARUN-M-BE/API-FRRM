import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";
import { safeFetch } from "@/lib/ssrf";
import { resolveVariables, resolveKVList } from "@/lib/variables";
import { runAssertions, extractVariables, Assertion, ExtractRule } from "@/lib/assertions";
import { decryptValue } from "@/lib/encryption";

interface RequestRow {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; enabled?: boolean }[];
  params: { key: string; value: string; enabled?: boolean }[];
  auth_type: string;
  auth_config: Record<string, string>;
  body_type: string;
  body_content: string;
  assertions: Assertion[];
  extract_rules: ExtractRule[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id: collectionId } = await params;
    const body = await request.json().catch(() => ({}));
    const { environment_id = null } = body;

    // Verify collection ownership
    const collections = await executeRawSql(
      `SELECT * FROM collections WHERE id = $1 AND user_id = $2`,
      [collectionId, auth.userId]
    );
    if (collections.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Load active environment variables if provided
    const runVariables: Record<string, string> = {};
    if (environment_id) {
      const envs = await executeRawSql(
        `SELECT * FROM environments WHERE id = $1 AND user_id = $2`,
        [environment_id, auth.userId]
      );
      if (envs.length > 0 && Array.isArray(envs[0].variables)) {
        for (const v of envs[0].variables) {
          if (!v.key) continue;
          if (v.is_secret && v.encrypted_value) {
            try {
              runVariables[v.key] = await decryptValue(v.encrypted_value);
            } catch {
              runVariables[v.key] = "";
            }
          } else {
            runVariables[v.key] = v.value || "";
          }
        }
      }
    }

    // Fetch all requests in the collection ordered by folder sort_order and request sort_order
    const reqRows = (await executeRawSql(
      `SELECT r.*
       FROM requests r
       LEFT JOIN folders f ON r.folder_id = f.id
       WHERE r.collection_id = $1
       ORDER BY COALESCE(f.sort_order, 0) ASC, r.sort_order ASC, r.created_at ASC`,
      [collectionId]
    )) as unknown as RequestRow[];

    if (reqRows.length === 0) {
      return NextResponse.json(
        { error: "Collection has no requests to run" },
        { status: 400 }
      );
    }

    const runStart = Date.now();
    const runResults = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const reqItem of reqRows) {
      const itemStart = Date.now();
      try {
        const resolvedUrl = resolveVariables(reqItem.url || "", runVariables);
        const resolvedHeadersList = resolveKVList(reqItem.headers || [], runVariables);
        const resolvedBody = reqItem.body_content
          ? resolveVariables(reqItem.body_content, runVariables)
          : "";

        const finalHeaders: Record<string, string> = {};
        for (const h of resolvedHeadersList) {
          if (h.enabled !== false && h.key.trim()) {
            finalHeaders[h.key.trim()] = h.value;
          }
        }

        // Apply auth
        if (reqItem.auth_type === "bearer" && reqItem.auth_config?.token) {
          finalHeaders["authorization"] = `Bearer ${resolveVariables(reqItem.auth_config.token, runVariables)}`;
        } else if (reqItem.auth_type === "basic" && (reqItem.auth_config?.username || reqItem.auth_config?.password)) {
          const u = resolveVariables(reqItem.auth_config.username || "", runVariables);
          const p = resolveVariables(reqItem.auth_config.password || "", runVariables);
          finalHeaders["authorization"] = `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
        } else if (reqItem.auth_type === "api-key" && reqItem.auth_config?.key && reqItem.auth_config?.value) {
          finalHeaders[resolveVariables(reqItem.auth_config.key, runVariables)] = resolveVariables(reqItem.auth_config.value, runVariables);
        }

        if (reqItem.body_type === "json" && !finalHeaders["content-type"]) {
          finalHeaders["content-type"] = "application/json";
        }

        const fetchInit: RequestInit = {
          method: (reqItem.method || "GET").toUpperCase(),
          headers: finalHeaders,
        };
        if (["POST", "PUT", "PATCH"].includes(fetchInit.method!) && reqItem.body_type !== "none") {
          fetchInit.body = resolvedBody;
        }

        const res = await safeFetch(resolvedUrl, fetchInit);

        let parsedJson: unknown = undefined;
        if ((res.headers["content-type"] || "").includes("application/json") && res.body) {
          try {
            parsedJson = JSON.parse(res.body);
          } catch {
            // ignore
          }
        }

        // Run assertions
        const assertions = Array.isArray(reqItem.assertions) ? reqItem.assertions : [];
        const assertionResults = runAssertions(assertions, {
          status: res.status,
          timeMs: res.timeMs,
          headers: res.headers,
          body: res.body,
          parsedJson,
        });

        const allPassed = assertionResults.every((a) => a.passed);
        if (allPassed) passedCount++;
        else failedCount++;

        // Extract variables to carry forward to subsequent requests
        const extractRules = Array.isArray(reqItem.extract_rules) ? reqItem.extract_rules : [];
        const newlyExtracted = extractVariables(parsedJson, extractRules);
        Object.assign(runVariables, newlyExtracted);

        runResults.push({
          request_id: reqItem.id,
          name: reqItem.name,
          method: reqItem.method,
          url: resolvedUrl,
          status: res.status,
          timeMs: res.timeMs,
          sizeBytes: res.sizeBytes,
          passed: allPassed,
          assertionResults,
          extractedVariables: newlyExtracted,
        });
      } catch (reqErr: unknown) {
        failedCount++;
        const message = reqErr instanceof Error ? reqErr.message : String(reqErr);
        runResults.push({
          request_id: reqItem.id,
          name: reqItem.name,
          method: reqItem.method,
          url: reqItem.url,
          status: 0,
          timeMs: Date.now() - itemStart,
          passed: false,
          error: message,
          assertionResults: [],
        });
      }
    }

    const totalTimeMs = Date.now() - runStart;
    const runStatus = failedCount === 0 ? "passed" : "failed";

    // Save run in collection_runs
    const savedRun = await executeRawSql(
      `INSERT INTO collection_runs (
        user_id, collection_id, environment_id, status,
        total_requests, passed_count, failed_count, total_time_ms, results, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      RETURNING *`,
      [
        auth.userId,
        collectionId,
        environment_id,
        runStatus,
        reqRows.length,
        passedCount,
        failedCount,
        totalTimeMs,
        JSON.stringify(runResults),
      ]
    );

    return NextResponse.json({
      run: savedRun[0],
      summary: {
        status: runStatus,
        total: reqRows.length,
        passed: passedCount,
        failed: failedCount,
        timeMs: totalTimeMs,
      },
      results: runResults,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

