import { sql } from './db';
export * from './curl';
import {
  DiscoveredApi,
  DiscoveredHeader,
  DiscoveredParam,
  buildSampleBodyFromColumns,
  generateCurlCommand,
} from './curl';

/**
 * Discovers all system platform APIs and dynamic user-generated REST APIs
 */
export async function discoverAllApis(userId: string, appBaseUrl = ''): Promise<DiscoveredApi[]> {
  const discovered: DiscoveredApi[] = [];

  // 1. Fetch user's projects and dynamic database APIs
  const projectApis = await sql<
    {
      id: string;
      project_id: string;
      project_name: string;
      project_api_key: string;
      name: string;
      version: string;
      columns: any;
      check_url: string | null;
      is_up: boolean | null;
      last_checked_at: string | null;
    }[]
  >`
    SELECT a.id, a.project_id, a.name, a.version, a.columns, a.check_url, a.is_up, a.last_checked_at,
           p.name AS project_name, p.api_key AS project_api_key
    FROM apis a
    JOIN projects p ON p.id = a.project_id
    WHERE p.user_id = ${userId}
    ORDER BY p.name ASC, a.name ASC, a.version ASC
  `;

  // Fetch recent check logs for these APIs
  const apiIds = projectApis.map((a) => a.id);
  const checksByApi = new Map<string, { status_code: number; latency_ms: number; checked_at: string }[]>();

  if (apiIds.length > 0) {
    const checks = await sql<
      {
        api_id: string;
        status_code: number;
        latency_ms: number;
        checked_at: string;
      }[]
    >`
      SELECT c.api_id, c.status_code, c.latency_ms, c.checked_at
      FROM api_checks c
      WHERE c.api_id = ANY(${apiIds})
        AND c.checked_at > now() - interval '7 days'
      ORDER BY c.checked_at DESC
      LIMIT 1000
    `;

    for (const c of checks) {
      if (!checksByApi.has(c.api_id)) checksByApi.set(c.api_id, []);
      const list = checksByApi.get(c.api_id)!;
      if (list.length < 30) list.push(c);
    }
  }

  // 2. Generate entries for Dynamic User APIs
  for (const api of projectApis) {
    const checks = checksByApi.get(api.id) || [];
    const latestCheck = checks[0] || null;

    // Calculate uptime %
    let uptime = 100;
    if (checks.length > 0) {
      const up = checks.filter((c) => c.status_code >= 200 && c.status_code < 400).length;
      uptime = Math.round((up / checks.length) * 1000) / 10;
    }

    // Calculate consecutive failures
    let consecutiveFailures = 0;
    for (const c of checks) {
      if (c.status_code < 200 || c.status_code >= 400) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    const avgLatency =
      checks.length > 0
        ? Math.round(checks.reduce((acc, c) => acc + c.latency_ms, 0) / checks.length)
        : 0;

    const latestLatency = latestCheck ? latestCheck.latency_ms : null;
    const isUp = api.is_up ?? (latestCheck ? latestCheck.status_code >= 200 && latestCheck.status_code < 400 : null);

    // Determine Health status: Healthy, Degraded, Down, Unknown
    let status: DiscoveredApi['status'] = 'Unknown';
    if (isUp === false || (latestCheck && latestCheck.status_code >= 400)) {
      status = 'Down';
    } else if (isUp === true) {
      if (latestLatency && latestLatency > 500) {
        status = 'Degraded';
      } else if (uptime < 90) {
        status = 'Degraded';
      } else {
        status = 'Healthy';
      }
    }

    const checkHistory = checks.map((c) => ({
      status_code: c.status_code,
      latency_ms: c.latency_ms,
      checked_at: c.checked_at,
      is_up: c.status_code >= 200 && c.status_code < 400,
    }));

    const sampleBody = buildSampleBodyFromColumns(api.columns);
    const basePath = `/api/p/${api.project_name}/${api.version}/${api.name}`;

    // A. List & Filter Records (GET)
    discovered.push({
      id: `${api.id}-get-list`,
      name: `List ${api.name}`,
      category: 'Generated REST APIs',
      method: 'GET',
      endpoint: basePath,
      description: `Query and paginate records from "${api.project_name}.${api.name}". Supports ?limit, ?offset, ?order, and column filters.`,
      headers: [
        { key: 'Accept', value: 'application/json', required: true },
      ],
      params: [
        { key: 'limit', value: '10', type: 'number', description: 'Maximum rows to return (default 50, max 100)' },
        { key: 'offset', value: '0', type: 'number', description: 'Offset pagination' },
        { key: 'order', value: 'id:desc', type: 'string', description: 'Order by column:asc|desc' },
      ],
      bodySchema: null,
      auth: {
        type: 'api-key',
        headerKey: 'x-api-key',
        description: `Project API key for "${api.project_name}"`,
      },
      status,
      is_up: isUp,
      last_checked_at: api.last_checked_at || (latestCheck ? latestCheck.checked_at : null),
      latest_latency_ms: latestLatency,
      avg_latency_ms: avgLatency,
      uptime_percent: uptime,
      latest_status_code: latestCheck ? latestCheck.status_code : null,
      consecutive_failures: consecutiveFailures,
      check_history: checkHistory,
      project_name: api.project_name,
      project_id: api.project_id,
      project_api_key: api.project_api_key,
      version: api.version,
      columns: api.columns,
      check_url: api.check_url,
    });

    // B. Create Record (POST)
    discovered.push({
      id: `${api.id}-post-create`,
      name: `Create ${api.name}`,
      category: 'Generated REST APIs',
      method: 'POST',
      endpoint: basePath,
      description: `Inserts a new record into table "${api.name}". Generates a UUID and timestamps automatically.`,
      headers: [
        { key: 'Content-Type', value: 'application/json', required: true },
      ],
      params: [],
      bodySchema: sampleBody,
      auth: {
        type: 'api-key',
        headerKey: 'x-api-key',
        description: `Project API key for "${api.project_name}"`,
      },
      status,
      is_up: isUp,
      last_checked_at: api.last_checked_at || (latestCheck ? latestCheck.checked_at : null),
      latest_latency_ms: latestLatency,
      avg_latency_ms: avgLatency,
      uptime_percent: uptime,
      latest_status_code: latestCheck ? latestCheck.status_code : null,
      consecutive_failures: consecutiveFailures,
      check_history: checkHistory,
      project_name: api.project_name,
      project_id: api.project_id,
      project_api_key: api.project_api_key,
      version: api.version,
      columns: api.columns,
      check_url: api.check_url,
    });

    // C. Get Single Record by ID (GET)
    discovered.push({
      id: `${api.id}-get-item`,
      name: `Get ${api.name} by ID`,
      category: 'Generated REST APIs',
      method: 'GET',
      endpoint: `${basePath}/:id`,
      description: `Fetch a single record by its UUID primary key from "${api.name}".`,
      headers: [
        { key: 'Accept', value: 'application/json', required: true },
      ],
      params: [
        { key: 'id', value: '00000000-0000-0000-0000-000000000000', type: 'uuid', description: 'Record UUID', required: true },
      ],
      bodySchema: null,
      auth: {
        type: 'api-key',
        headerKey: 'x-api-key',
        description: `Project API key for "${api.project_name}"`,
      },
      status,
      is_up: isUp,
      last_checked_at: api.last_checked_at || (latestCheck ? latestCheck.checked_at : null),
      latest_latency_ms: latestLatency,
      avg_latency_ms: avgLatency,
      uptime_percent: uptime,
      latest_status_code: latestCheck ? latestCheck.status_code : null,
      consecutive_failures: consecutiveFailures,
      check_history: checkHistory,
      project_name: api.project_name,
      project_id: api.project_id,
      project_api_key: api.project_api_key,
      version: api.version,
      columns: api.columns,
    });

    // D. Update / Patch Record (PATCH)
    discovered.push({
      id: `${api.id}-patch-item`,
      name: `Update ${api.name} by ID`,
      category: 'Generated REST APIs',
      method: 'PATCH',
      endpoint: `${basePath}/:id`,
      description: `Partially updates specific columns of an existing record in "${api.name}".`,
      headers: [
        { key: 'Content-Type', value: 'application/json', required: true },
      ],
      params: [
        { key: 'id', value: '00000000-0000-0000-0000-000000000000', type: 'uuid', description: 'Record UUID', required: true },
      ],
      bodySchema: sampleBody,
      auth: {
        type: 'api-key',
        headerKey: 'x-api-key',
        description: `Project API key for "${api.project_name}"`,
      },
      status,
      is_up: isUp,
      last_checked_at: api.last_checked_at || (latestCheck ? latestCheck.checked_at : null),
      latest_latency_ms: latestLatency,
      avg_latency_ms: avgLatency,
      uptime_percent: uptime,
      latest_status_code: latestCheck ? latestCheck.status_code : null,
      consecutive_failures: consecutiveFailures,
      check_history: checkHistory,
      project_name: api.project_name,
      project_id: api.project_id,
      project_api_key: api.project_api_key,
      version: api.version,
      columns: api.columns,
    });

    // E. Delete Record (DELETE)
    discovered.push({
      id: `${api.id}-delete-item`,
      name: `Delete ${api.name} by ID`,
      category: 'Generated REST APIs',
      method: 'DELETE',
      endpoint: `${basePath}/:id`,
      description: `Permanently deletes a row matching UUID from table "${api.name}".`,
      headers: [],
      params: [
        { key: 'id', value: '00000000-0000-0000-0000-000000000000', type: 'uuid', description: 'Record UUID', required: true },
      ],
      bodySchema: null,
      auth: {
        type: 'api-key',
        headerKey: 'x-api-key',
        description: `Project API key for "${api.project_name}"`,
      },
      status,
      is_up: isUp,
      last_checked_at: api.last_checked_at || (latestCheck ? latestCheck.checked_at : null),
      latest_latency_ms: latestLatency,
      avg_latency_ms: avgLatency,
      uptime_percent: uptime,
      latest_status_code: latestCheck ? latestCheck.status_code : null,
      consecutive_failures: consecutiveFailures,
      check_history: checkHistory,
      project_name: api.project_name,
      project_id: api.project_id,
      project_api_key: api.project_api_key,
      version: api.version,
      columns: api.columns,
    });
  }

  // 3. Platform System APIs
  const platformEndpoints: DiscoveredApi[] = [
    {
      id: 'platform-projects-list',
      name: 'List Projects',
      category: 'Platform APIs',
      method: 'GET',
      endpoint: '/api/projects',
      description: 'Returns all projects and isolated database schemas belonging to the current user.',
      headers: [{ key: 'Accept', value: 'application/json' }],
      params: [],
      bodySchema: null,
      auth: { type: 'session', description: 'Signed HTTP session cookie' },
      status: 'Healthy',
      is_up: true,
      last_checked_at: new Date().toISOString(),
      latest_latency_ms: 18,
      avg_latency_ms: 22,
      uptime_percent: 100,
      latest_status_code: 200,
      consecutive_failures: 0,
      check_history: [],
    },
    {
      id: 'platform-projects-create',
      name: 'Create Project',
      category: 'Platform APIs',
      method: 'POST',
      endpoint: '/api/projects',
      description: 'Creates a new isolated database schema with automatic API key generation.',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      params: [],
      bodySchema: {
        name: 'my_new_service',
        database_type: 'postgres',
        database_url: null,
      },
      auth: { type: 'session', description: 'Signed HTTP session cookie' },
      status: 'Healthy',
      is_up: true,
      last_checked_at: new Date().toISOString(),
      latest_latency_ms: 45,
      avg_latency_ms: 50,
      uptime_percent: 100,
      latest_status_code: 200,
      consecutive_failures: 0,
      check_history: [],
    },
    {
      id: 'platform-monitor-status',
      name: 'Monitoring Summary',
      category: 'Platform APIs',
      method: 'GET',
      endpoint: '/api/monitor/status',
      description: 'Returns real-time health metrics, uptime calculations, and recent incidents.',
      headers: [{ key: 'Accept', value: 'application/json' }],
      params: [],
      bodySchema: null,
      auth: { type: 'session', description: 'Signed HTTP session cookie' },
      status: 'Healthy',
      is_up: true,
      last_checked_at: new Date().toISOString(),
      latest_latency_ms: 15,
      avg_latency_ms: 20,
      uptime_percent: 100,
      latest_status_code: 200,
      consecutive_failures: 0,
      check_history: [],
    },
    {
      id: 'platform-monitor-check-now',
      name: 'Trigger Health Check',
      category: 'Platform APIs',
      method: 'POST',
      endpoint: '/api/monitor/check-now',
      description: 'Immediately executes safe health probes against registered endpoints.',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      params: [],
      bodySchema: { api_id: null },
      auth: { type: 'session', description: 'Signed HTTP session cookie' },
      status: 'Healthy',
      is_up: true,
      last_checked_at: new Date().toISOString(),
      latest_latency_ms: 32,
      avg_latency_ms: 35,
      uptime_percent: 100,
      latest_status_code: 200,
      consecutive_failures: 0,
      check_history: [],
    },
    {
      id: 'platform-send-executor',
      name: 'SSRF Proxy Executor',
      category: 'API Client',
      method: 'POST',
      endpoint: '/api/send',
      description: 'Server-side request proxy with SSRF protection, timeout, and response cap.',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      params: [],
      bodySchema: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        headers: [],
        auth_type: 'none',
      },
      auth: { type: 'session', description: 'Signed HTTP session cookie' },
      status: 'Healthy',
      is_up: true,
      last_checked_at: new Date().toISOString(),
      latest_latency_ms: 25,
      avg_latency_ms: 28,
      uptime_percent: 100,
      latest_status_code: 200,
      consecutive_failures: 0,
      check_history: [],
    },
    {
      id: 'platform-auth-me',
      name: 'Current User Profile',
      category: 'Auth & Security',
      method: 'GET',
      endpoint: '/api/auth/me',
      description: 'Returns the currently authenticated user identity and session validity.',
      headers: [{ key: 'Accept', value: 'application/json' }],
      params: [],
      bodySchema: null,
      auth: { type: 'session', description: 'Signed HTTP session cookie' },
      status: 'Healthy',
      is_up: true,
      last_checked_at: new Date().toISOString(),
      latest_latency_ms: 12,
      avg_latency_ms: 15,
      uptime_percent: 100,
      latest_status_code: 200,
      consecutive_failures: 0,
      check_history: [],
    },
    {
      id: 'platform-cron-check',
      name: '24/7 Cron Health Runner',
      category: 'Platform APIs',
      method: 'POST',
      endpoint: '/api/cron/check',
      description: 'Automated background worker pinging all APIs and alerting on state changes.',
      headers: [
        { key: 'x-cron-secret', value: 'YOUR_CRON_SECRET', required: true },
      ],
      params: [],
      bodySchema: null,
      auth: { type: 'api-key', headerKey: 'x-cron-secret', description: 'Internal cron secret token' },
      status: 'Healthy',
      is_up: true,
      last_checked_at: new Date().toISOString(),
      latest_latency_ms: 38,
      avg_latency_ms: 40,
      uptime_percent: 100,
      latest_status_code: 200,
      consecutive_failures: 0,
      check_history: [],
    },
  ];

  discovered.push(...platformEndpoints);

  return discovered;
}
