/**
 * Import/Export for API collections.
 *
 * Supported imports:
 *   - Postman Collection v2.1 JSON
 *   - cURL command string
 *   - OpenAPI 3.x JSON/YAML (basic)
 *
 * Supported exports:
 *   - Postman Collection v2.1 JSON
 */

// ============================================================
// TYPES
// ============================================================

export interface ImportedRequest {
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  params: { key: string; value: string; enabled: boolean }[];
  body_type: "none" | "json" | "form" | "raw";
  body_content: string;
  auth_type: "none" | "bearer" | "basic" | "api-key";
  auth_config: Record<string, string>;
  folder?: string; // folder name for grouping
}

export interface ImportResult {
  name: string;
  description: string;
  requests: ImportedRequest[];
  folders: string[];
}

export interface ExportRequest {
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; enabled?: boolean }[];
  params: { key: string; value: string; enabled?: boolean }[];
  body_type: string;
  body_content: string;
  auth_type: string;
  auth_config: Record<string, string>;
  folder_name?: string;
}

// ============================================================
// POSTMAN V2.1 IMPORT
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

export function importPostmanCollection(json: any): ImportResult {
  const info = json.info || {};
  const result: ImportResult = {
    name: info.name || "Imported Collection",
    description: info.description || "",
    requests: [],
    folders: [],
  };

  function processItems(items: any[], folderName?: string) {
    for (const item of items || []) {
      if (item.item && Array.isArray(item.item)) {
        // It's a folder
        const fname = item.name || "Folder";
        if (!result.folders.includes(fname)) result.folders.push(fname);
        processItems(item.item, fname);
      } else if (item.request) {
        result.requests.push(parsePostmanRequest(item, folderName));
      }
    }
  }

  processItems(json.item);
  return result;
}

function parsePostmanRequest(item: any, folder?: string): ImportedRequest {
  const req = item.request;
  const rawUrl =
    typeof req.url === "string"
      ? req.url
      : req.url?.raw || buildPostmanUrl(req.url);

  const headers: ImportedRequest["headers"] = [];
  for (const h of req.header || []) {
    headers.push({
      key: h.key || "",
      value: h.value || "",
      enabled: h.disabled !== true,
    });
  }

  const params: ImportedRequest["params"] = [];
  const urlQuery =
    typeof req.url === "object" ? req.url.query || [] : [];
  for (const q of urlQuery) {
    params.push({
      key: q.key || "",
      value: q.value || "",
      enabled: q.disabled !== true,
    });
  }

  let body_type: ImportedRequest["body_type"] = "none";
  let body_content = "";
  if (req.body) {
    switch (req.body.mode) {
      case "raw":
        body_type =
          req.body.options?.raw?.language === "json" ? "json" : "raw";
        body_content = req.body.raw || "";
        break;
      case "urlencoded":
        body_type = "form";
        body_content = JSON.stringify(
          (req.body.urlencoded || []).map((p: any) => ({
            key: p.key,
            value: p.value,
          }))
        );
        break;
      case "formdata":
        body_type = "form";
        body_content = JSON.stringify(
          (req.body.formdata || []).map((p: any) => ({
            key: p.key,
            value: p.value,
          }))
        );
        break;
    }
  }

  let auth_type: ImportedRequest["auth_type"] = "none";
  const auth_config: Record<string, string> = {};
  const auth = req.auth;
  if (auth) {
    switch (auth.type) {
      case "bearer": {
        auth_type = "bearer";
        const tokenEntry = (auth.bearer || []).find(
          (e: any) => e.key === "token"
        );
        auth_config.token = tokenEntry?.value || "";
        break;
      }
      case "basic": {
        auth_type = "basic";
        const uEntry = (auth.basic || []).find(
          (e: any) => e.key === "username"
        );
        const pEntry = (auth.basic || []).find(
          (e: any) => e.key === "password"
        );
        auth_config.username = uEntry?.value || "";
        auth_config.password = pEntry?.value || "";
        break;
      }
      case "apikey": {
        auth_type = "api-key";
        const kEntry = (auth.apikey || []).find(
          (e: any) => e.key === "key"
        );
        const vEntry = (auth.apikey || []).find(
          (e: any) => e.key === "value"
        );
        auth_config.key = kEntry?.value || "x-api-key";
        auth_config.value = vEntry?.value || "";
        auth_config.add_to = "header";
        break;
      }
    }
  }

  return {
    name: item.name || "Request",
    method: (typeof req.method === "string" ? req.method : "GET").toUpperCase(),
    url: rawUrl,
    headers,
    params,
    body_type,
    body_content,
    auth_type,
    auth_config,
    folder,
  };
}

function buildPostmanUrl(urlObj: any): string {
  if (!urlObj) return "";
  const protocol = urlObj.protocol || "https";
  const host = (urlObj.host || []).join(".");
  const path = (urlObj.path || []).join("/");
  return `${protocol}://${host}/${path}`;
}

// ============================================================
// CURL IMPORT
// ============================================================

export function importCurl(curlString: string): ImportedRequest {
  const trimmed = curlString
    .trim()
    .replace(/\\\n\s*/g, " ") // join line continuations
    .replace(/^curl\s+/i, "");

  let method = "GET";
  let url = "";
  const headers: ImportedRequest["headers"] = [];
  let body_content = "";
  let body_type: ImportedRequest["body_type"] = "none";

  // Tokenize (simple, handles quoted strings)
  const tokens = tokenize(trimmed);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok === "-X" || tok === "--request") {
      method = (tokens[++i] || "GET").toUpperCase();
    } else if (tok === "-H" || tok === "--header") {
      const hdr = tokens[++i] || "";
      const colonIdx = hdr.indexOf(":");
      if (colonIdx > 0) {
        headers.push({
          key: hdr.slice(0, colonIdx).trim(),
          value: hdr.slice(colonIdx + 1).trim(),
          enabled: true,
        });
      }
    } else if (tok === "-d" || tok === "--data" || tok === "--data-raw" || tok === "--data-binary") {
      body_content = tokens[++i] || "";
      if (!method || method === "GET") method = "POST";
      // Guess JSON
      body_type = looksLikeJson(body_content) ? "json" : "raw";
    } else if (!tok.startsWith("-") && !url) {
      url = tok;
    }
  }

  // Parse query params from URL
  const params: ImportedRequest["params"] = [];
  try {
    const u = new URL(url);
    u.searchParams.forEach((v, k) => {
      params.push({ key: k, value: v, enabled: true });
    });
  } catch {
    // ignore invalid URLs
  }

  return {
    name: `${method} ${url.split("?")[0].split("/").pop() || "request"}`,
    method,
    url,
    headers,
    params,
    body_type,
    body_content,
    auth_type: "none",
    auth_config: {},
  };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (const ch of input) {
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === " " && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

// ============================================================
// OPENAPI 3.x IMPORT (basic)
// ============================================================

export function importOpenApi(spec: any): ImportResult {
  const result: ImportResult = {
    name: spec.info?.title || "OpenAPI Import",
    description: spec.info?.description || "",
    requests: [],
    folders: [],
  };

  const servers = spec.servers || [{ url: "https://api.example.com" }];
  const baseUrl = servers[0]?.url || "https://api.example.com";

  const paths = spec.paths || {};
  const tagFolders = new Set<string>();

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      if (["get", "post", "put", "patch", "delete", "head", "options"].indexOf(method) === -1) continue;

      const op = operation as any;
      const tags = op.tags || ["Default"];
      const folder = tags[0];
      tagFolders.add(folder);

      const headers: ImportedRequest["headers"] = [];
      const params: ImportedRequest["params"] = [];

      for (const param of op.parameters || []) {
        if (param.in === "header") {
          headers.push({ key: param.name, value: `{{${param.name}}}`, enabled: true });
        } else if (param.in === "query") {
          params.push({ key: param.name, value: "", enabled: true });
        }
      }

      let body_type: ImportedRequest["body_type"] = "none";
      let body_content = "";
      if (op.requestBody?.content) {
        const jsonContent = op.requestBody.content["application/json"];
        if (jsonContent?.schema) {
          body_type = "json";
          body_content = schemaToExample(jsonContent.schema, spec);
        }
      }

      result.requests.push({
        name: op.summary || op.operationId || `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        url: `${baseUrl}${path}`,
        headers,
        params,
        body_type,
        body_content,
        auth_type: "none",
        auth_config: {},
        folder,
      });
    }
  }

  result.folders = Array.from(tagFolders);
  return result;
}

function schemaToExample(schema: any, root: any): string {
  if (!schema) return "{}";

  // Resolve $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace("#/", "").split("/");
    let resolved = root;
    for (const seg of refPath) resolved = resolved?.[seg];
    return schemaToExample(resolved, root);
  }

  if (schema.example) return JSON.stringify(schema.example, null, 2);

  if (schema.type === "object" || schema.properties) {
    const obj: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      const p = prop as any;
      obj[key] =
        p.example ?? p.default ?? exampleForType(p.type, p.format);
    }
    return JSON.stringify(obj, null, 2);
  }

  if (schema.type === "array" && schema.items) {
    return `[${schemaToExample(schema.items, root)}]`;
  }

  return JSON.stringify(exampleForType(schema.type, schema.format));
}

function exampleForType(type?: string, format?: string): unknown {
  switch (type) {
    case "string":
      return format === "email"
        ? "user@example.com"
        : format === "date-time"
          ? new Date().toISOString()
          : "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    default:
      return null;
  }
}

// ============================================================
// POSTMAN V2.1 EXPORT
// ============================================================

export function exportPostmanCollection(
  collectionName: string,
  description: string,
  requests: ExportRequest[],
  folders: string[]
): object {
  const folderMap: Record<string, any[]> = {};
  for (const f of folders) folderMap[f] = [];

  const topLevel: any[] = [];

  for (const req of requests) {
    const item = buildPostmanItem(req);
    if (req.folder_name && folderMap[req.folder_name]) {
      folderMap[req.folder_name].push(item);
    } else {
      topLevel.push(item);
    }
  }

  const items: any[] = [];

  // Add folders first
  for (const [name, children] of Object.entries(folderMap)) {
    items.push({ name, item: children });
  }
  // Then top-level requests
  items.push(...topLevel);

  return {
    info: {
      name: collectionName,
      description,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: items,
  };
}

function buildPostmanItem(req: ExportRequest): object {
  const urlObj: any = { raw: req.url };
  try {
    const u = new URL(req.url);
    urlObj.protocol = u.protocol.replace(":", "");
    urlObj.host = u.hostname.split(".");
    urlObj.path = u.pathname.split("/").filter(Boolean);
    if (u.search) {
      urlObj.query = (req.params || []).map((p) => ({
        key: p.key,
        value: p.value,
        disabled: p.enabled === false,
      }));
    }
  } catch {
    // leave raw only
  }

  const header = (req.headers || []).map((h) => ({
    key: h.key,
    value: h.value,
    disabled: h.enabled === false,
  }));

  const item: any = {
    name: req.name,
    request: {
      method: req.method,
      header,
      url: urlObj,
    },
  };

  // Body
  if (req.body_type === "json") {
    item.request.body = {
      mode: "raw",
      raw: req.body_content,
      options: { raw: { language: "json" } },
    };
  } else if (req.body_type === "form") {
    try {
      const formData = JSON.parse(req.body_content);
      item.request.body = {
        mode: "urlencoded",
        urlencoded: formData,
      };
    } catch {
      item.request.body = { mode: "raw", raw: req.body_content };
    }
  } else if (req.body_type === "raw") {
    item.request.body = { mode: "raw", raw: req.body_content };
  }

  // Auth
  if (req.auth_type === "bearer") {
    item.request.auth = {
      type: "bearer",
      bearer: [{ key: "token", value: req.auth_config.token || "" }],
    };
  } else if (req.auth_type === "basic") {
    item.request.auth = {
      type: "basic",
      basic: [
        { key: "username", value: req.auth_config.username || "" },
        { key: "password", value: req.auth_config.password || "" },
      ],
    };
  } else if (req.auth_type === "api-key") {
    item.request.auth = {
      type: "apikey",
      apikey: [
        { key: "key", value: req.auth_config.key || "x-api-key" },
        { key: "value", value: req.auth_config.value || "" },
      ],
    };
  }

  return item;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

