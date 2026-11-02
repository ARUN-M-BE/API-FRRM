export interface ApiCollection {
  id: string;
  user_id: string;
  project_id?: string | null;
  name: string;
  description?: string;
  auto_generated: boolean;
  request_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ApiFolder {
  id: string;
  collection_id: string;
  parent_folder_id?: string | null;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface KeyValueItem {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface Assertion {
  type: "status" | "latency" | "header" | "json_path" | "body_contains";
  target?: string;
  operator:
    | "eq"
    | "neq"
    | "lt"
    | "gt"
    | "lte"
    | "gte"
    | "contains"
    | "not_contains"
    | "exists"
    | "not_exists";
  expected?: string | number;
}

export interface ExtractRule {
  json_path: string;
  variable_name: string;
}

export interface ApiRequest {
  id: string;
  collection_id: string;
  folder_id?: string | null;
  name: string;
  method: string;
  url: string;
  params: KeyValueItem[];
  headers: KeyValueItem[];
  auth_type: "none" | "bearer" | "basic" | "api-key";
  auth_config: Record<string, string>;
  body_type: "none" | "json" | "form" | "raw";
  body_content: string;
  assertions: Assertion[];
  extract_rules: ExtractRule[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface EnvVariable {
  key: string;
  value: string;
  is_secret?: boolean;
}

export interface ApiEnvironment {
  id: string;
  user_id: string;
  project_id?: string | null;
  name: string;
  variables: EnvVariable[];
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: string;
  user_id: string;
  request_id?: string | null;
  collection_id?: string | null;
  method: string;
  url: string;
  request_headers: Record<string, string>;
  request_body?: string;
  response_status: number;
  response_time_ms: number;
  response_size_bytes: number;
  response_headers: Record<string, string>;
  response_body?: string;
  assertions_result?: AssertionResult[];
  created_at: string;
}

export interface AssertionResult {
  type: string;
  target?: string;
  operator: string;
  expected?: string | number;
  actual?: unknown;
  passed: boolean;
  message: string;
}

export interface SendResponse {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  truncated: boolean;
  headers: Record<string, string>;
  body: string;
  parsedJson?: unknown;
  assertionResults?: AssertionResult[];
  extractedVariables?: Record<string, string>;
}

