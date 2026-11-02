import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { executeRawSql } from "@/lib/db";
import { safeFetch } from "@/lib/ssrf";
import { resolveVariables, resolveKVList } from "@/lib/variables";
import { runAssertions, extractVariables, Assertion, ExtractRule } from "@/lib/assertions";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const userId = auth.userId;

    // Rate limiting: max 120 calls per 60 seconds per user
    const rateCheck = await executeRawSql(
      `SELECT COUNT(*)::int AS count 
       FROM request_history 
       WHERE user_id = $1 AND created_at > now() - interval '60 seconds'`,
      [userId]
    );
    const recentCount = rateCheck[0]?.count ?? 0;
    if (recentCount >= 120) {
      return NextResponse.json(
        { error: "Rate limit exceeded (max 120 requests/minute)" },
        { status: 429 }
      );
    }

    const payload = await request.json();
    const {
      method = "GET",
      url,
      headers: rawHeaders = [],
      body: rawBody = "",
      body_type = "none",
      auth_type = "none",
      auth_config = {},
      assertions = [] as Assertion[],
      extract_rules = [] as ExtractRule[],
      environment_variables = {} as Record<string, string>,
      request_id = null,
      collection_id = null,
    } = payload;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing or invalid URL" }, { status: 400 });
    }

    // 1. Substitute variables
    const resolvedUrl = resolveVariables(url, environment_variables);
    const resolvedHeadersList = resolveKVList(rawHeaders, environment_variables);
    const resolvedBody = typeof rawBody === "string" ? resolveVariables(rawBody, environment_variables) : "";

    // 2. Build final request headers
    const finalHeaders: Record<string, string> = {};
    for (const item of resolvedHeadersList) {
      if (item.enabled !== false && item.key.trim()) {
        finalHeaders[item.key.trim()] = item.value;
      }
    }

    // Apply Auth
    if (auth_type === "bearer" && auth_config.token) {
      const resolvedToken = resolveVariables(auth_config.token, environment_variables);
      finalHeaders["authorization"] = `Bearer ${resolvedToken}`;
    } else if (auth_type === "basic" && (auth_config.username || auth_config.password)) {
      const u = resolveVariables(auth_config.username || "", environment_variables);
      const p = resolveVariables(auth_config.password || "", environment_variables);
      const b64 = Buffer.from(`${u}:${p}`).toString("base64");
      finalHeaders["authorization"] = `Basic ${b64}`;
    } else if (auth_type === "api-key" && auth_config.key && auth_config.value) {
      const k = resolveVariables(auth_config.key, environment_variables);
      const v = resolveVariables(auth_config.value, environment_variables);
      if (auth_config.add_to === "query") {
        // Appended to URL query if chosen
        // We'll keep header as default
        finalHeaders[k] = v;
      } else {
        finalHeaders[k] = v;
      }
    }

    if (body_type === "json" && !finalHeaders["content-type"]) {
      finalHeaders["content-type"] = "application/json";
    }

    // 3. Execute safe fetch with SSRF protection, timeout, and response cap
    const fetchInit: RequestInit = {
      method: method.toUpperCase(),
      headers: finalHeaders,
    };

    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body_type !== "none") {
      fetchInit.body = resolvedBody;
    }

    const res = await safeFetch(resolvedUrl, fetchInit);

    // 4. Parse JSON if applicable
    let parsedJson: unknown = undefined;
    const isJson = (res.headers["content-type"] || "").includes("application/json");
    if (isJson && res.body) {
      try {
        parsedJson = JSON.parse(res.body);
      } catch {
        // Leave undefined if parse fails
      }
    }

    // 5. Run Declarative Assertions
    const assertionResults = runAssertions(assertions, {
      status: res.status,
      timeMs: res.timeMs,
      headers: res.headers,
      body: res.body,
      parsedJson,
    });

    // 6. Run JSON Path Extractions
    const extractedVariables = extractVariables(parsedJson, extract_rules);

    // 7. Save to request_history
    try {
      await executeRawSql(
        `INSERT INTO request_history (
          user_id, request_id, collection_id, method, url,
          request_headers, request_body, response_status, response_time_ms,
          response_size_bytes, response_headers, response_body, assertions_result
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          userId,
          request_id,
          collection_id,
          method.toUpperCase(),
          resolvedUrl,
          JSON.stringify(finalHeaders),
          resolvedBody || null,
          res.status,
          res.timeMs,
          res.sizeBytes,
          JSON.stringify(res.headers),
          res.body.slice(0, 100000), // cap history body to 100kb
          JSON.stringify(assertionResults),
        ]
      );
    } catch (dbErr) {
      console.error("Failed to log request history:", dbErr);
    }

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      timeMs: res.timeMs,
      sizeBytes: res.sizeBytes,
      truncated: res.truncated,
      headers: res.headers,
      body: res.body,
      parsedJson,
      assertionResults,
      extractedVariables,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

