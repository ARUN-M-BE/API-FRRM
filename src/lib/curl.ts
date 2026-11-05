export interface DiscoveredHeader {
  key: string;
  value: string;
  description?: string;
  required?: boolean;
}

export interface DiscoveredParam {
  key: string;
  value: string;
  type?: string;
  description?: string;
  required?: boolean;
}

export interface DiscoveredApi {
  id: string;
  name: string;
  category: 'Generated REST APIs' | 'Platform APIs' | 'API Client' | 'Auth & Security';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  endpoint: string;
  description: string;
  headers: DiscoveredHeader[];
  params: DiscoveredParam[];
  bodySchema?: Record<string, any> | null;
  auth: {
    type: 'api-key' | 'bearer' | 'basic' | 'session' | 'none';
    headerKey?: string;
    description: string;
  };
  status: 'Healthy' | 'Degraded' | 'Down' | 'Unknown';
  is_up: boolean | null;
  last_checked_at: string | null;
  latest_latency_ms: number | null;
  avg_latency_ms: number;
  uptime_percent: number;
  latest_status_code: number | null;
  consecutive_failures: number;
  check_history: {
    status_code: number;
    latency_ms: number;
    checked_at: string;
    is_up: boolean;
  }[];
  project_name?: string;
  project_id?: string;
  project_api_key?: string;
  version?: string;
  columns?: any[];
  check_url?: string | null;
}

/**
 * Builds sample JSON body based on table column definitions
 */
export function buildSampleBodyFromColumns(columns: any[]): Record<string, any> {
  const sample: Record<string, any> = {};
  if (!Array.isArray(columns)) return sample;

  for (const col of columns) {
    if (col.name === 'id' || col.name === 'created_at' || col.name === 'updated_at') continue;
    switch (col.type) {
      case 'int':
      case 'bigint':
        sample[col.name] = 42;
        break;
      case 'float':
        sample[col.name] = 29.99;
        break;
      case 'bool':
        sample[col.name] = true;
        break;
      case 'json':
        sample[col.name] = { key: 'value' };
        break;
      case 'timestamp':
        sample[col.name] = new Date().toISOString();
        break;
      default:
        sample[col.name] = col.name.includes('email') ? 'user@example.com' : 'Sample Text';
    }
  }
  return sample;
}

/**
 * Generates an executable cURL command for an API definition
 */
export function generateCurlCommand(
  api: Pick<DiscoveredApi, 'method' | 'endpoint' | 'headers' | 'params' | 'bodySchema' | 'auth' | 'project_api_key'>,
  baseUrl = 'http://localhost:3000',
  maskSecrets = false
): string {
  const fullUrl = api.endpoint.startsWith('http') ? api.endpoint : `${baseUrl}${api.endpoint}`;
  
  // Format query params if any
  let urlWithParams = fullUrl;
  const activeParams = (api.params || []).filter((p) => p.value !== '');
  if (activeParams.length > 0 && !urlWithParams.includes('?')) {
    const qs = activeParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    urlWithParams = `${urlWithParams}?${qs}`;
  }

  const lines: string[] = [`curl --location '${urlWithParams}'`];

  if (api.method !== 'GET') {
    lines.push(`  --request ${api.method}`);
  }

  // Headers
  for (const h of api.headers || []) {
    let val = h.value;
    if (maskSecrets && (h.key.toLowerCase().includes('key') || h.key.toLowerCase().includes('auth') || h.key.toLowerCase().includes('secret'))) {
      val = val.length > 6 ? `${val.substring(0, 4)}••••••••` : '••••••••';
    }
    lines.push(`  --header '${h.key}: ${val}'`);
  }

  // Project API Key if applicable
  if (api.auth?.type === 'api-key' && api.project_api_key) {
    const headerName = api.auth.headerKey || 'x-api-key';
    const exists = (api.headers || []).some((h) => h.key.toLowerCase() === headerName.toLowerCase());
    if (!exists) {
      const val = maskSecrets && api.project_api_key.length > 6
        ? `${api.project_api_key.substring(0, 4)}••••••••`
        : api.project_api_key;
      lines.push(`  --header '${headerName}: ${val}'`);
    }
  }

  // Bearer auth
  if (api.auth?.type === 'bearer') {
    const exists = (api.headers || []).some((h) => h.key.toLowerCase() === 'authorization');
    if (!exists) {
      lines.push(`  --header 'Authorization: Bearer ${maskSecrets ? '••••••••' : 'YOUR_TOKEN'}'`);
    }
  }

  // Body for POST / PUT / PATCH
  if (['POST', 'PUT', 'PATCH'].includes(api.method) && api.bodySchema) {
    const hasContentType = (api.headers || []).some((h) => h.key.toLowerCase() === 'content-type');
    if (!hasContentType) {
      lines.push(`  --header 'Content-Type: application/json'`);
    }
    const jsonStr = JSON.stringify(api.bodySchema, null, 2);
    lines.push(`  --data '${jsonStr}'`);
  }

  return lines.join(' \\\n');
}
