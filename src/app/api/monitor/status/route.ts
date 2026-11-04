import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Fetch all user's projects and APIs
    const apis = await sql<
      {
        id: string;
        project_id: string;
        project_name: string;
        name: string;
        version: string;
        check_url: string | null;
        is_up: boolean | null;
        last_checked_at: string | null;
        created_at: string;
      }[]
    >`
      SELECT a.id, a.project_id, a.name, a.version, a.check_url, a.is_up, a.last_checked_at, a.created_at,
             p.name AS project_name
      FROM apis a
      JOIN projects p ON p.id = a.project_id
      WHERE p.user_id = ${auth.userId}
      ORDER BY p.name ASC, a.name ASC, a.version ASC
    `;

    if (!apis || apis.length === 0) {
      return NextResponse.json({
        summary: {
          total: 0,
          up: 0,
          down: 0,
          uptimePercent: 100,
          avgLatencyMs: 0,
          systemStatus: 'OPERATIONAL',
        },
        services: [],
        incidents: [],
      });
    }

    const apiIds = apis.map((a) => a.id);

    // Fetch the last 30 checks for each API (within the last 7 days)
    const recentChecks = await sql<
      {
        id: string;
        api_id: string;
        status_code: number;
        latency_ms: number;
        checked_at: string;
      }[]
    >`
      SELECT c.id, c.api_id, c.status_code, c.latency_ms, c.checked_at
      FROM api_checks c
      WHERE c.api_id = ANY(${apiIds})
        AND c.checked_at > now() - interval '7 days'
      ORDER BY c.checked_at DESC
      LIMIT 1000
    `;

    // Group checks by api_id
    const checksByApi = new Map<string, typeof recentChecks>();
    for (const check of recentChecks) {
      if (!checksByApi.has(check.api_id)) {
        checksByApi.set(check.api_id, []);
      }
      const list = checksByApi.get(check.api_id)!;
      if (list.length < 30) {
        list.push(check);
      }
    }

    let totalChecksCount = 0;
    let successfulChecksCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    let upCount = 0;
    let downCount = 0;

    const services = apis.map((api) => {
      const checks = checksByApi.get(api.id) || [];
      const latestCheck = checks[0] || null;

      let serviceUptime = 100;
      if (checks.length > 0) {
        const passed = checks.filter((c) => c.status_code >= 200 && c.status_code < 400).length;
        serviceUptime = Math.round((passed / checks.length) * 1000) / 10;
        totalChecksCount += checks.length;
        successfulChecksCount += passed;
      }

      const avgServiceLatency = checks.length > 0
        ? Math.round(checks.reduce((acc, c) => acc + c.latency_ms, 0) / checks.length)
        : 0;

      if (avgServiceLatency > 0) {
        totalLatency += avgServiceLatency;
        latencyCount++;
      }

      const isUp = api.is_up ?? (latestCheck ? latestCheck.status_code >= 200 && latestCheck.status_code < 400 : true);
      if (isUp) upCount++;
      else downCount++;

      return {
        id: api.id,
        project_id: api.project_id,
        project_name: api.project_name,
        name: api.name,
        version: api.version,
        check_url: api.check_url,
        is_up: isUp,
        last_checked_at: api.last_checked_at || (latestCheck ? latestCheck.checked_at : null),
        latest_status_code: latestCheck ? latestCheck.status_code : null,
        latest_latency_ms: latestCheck ? latestCheck.latency_ms : null,
        uptime_percent: serviceUptime,
        avg_latency_ms: avgServiceLatency,
        history: checks.reverse().map((c) => ({
          status_code: c.status_code,
          latency_ms: c.latency_ms,
          checked_at: c.checked_at,
          is_up: c.status_code >= 200 && c.status_code < 400,
        })),
      };
    });

    const overallUptime = totalChecksCount > 0
      ? Math.round((successfulChecksCount / totalChecksCount) * 1000) / 10
      : 100;

    const avgGlobalLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    let systemStatus: 'OPERATIONAL' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE' = 'OPERATIONAL';
    if (downCount > 0) {
      systemStatus = downCount === apis.length ? 'MAJOR_OUTAGE' : 'PARTIAL_OUTAGE';
    }

    // Fetch recent incidents (failed checks)
    const incidents = await sql<
      {
        id: string;
        api_id: string;
        status_code: number;
        latency_ms: number;
        checked_at: string;
        api_name: string;
        version: string;
        project_name: string;
      }[]
    >`
      SELECT c.id, c.api_id, c.status_code, c.latency_ms, c.checked_at,
             a.name AS api_name, a.version, p.name AS project_name
      FROM api_checks c
      JOIN apis a ON a.id = c.api_id
      JOIN projects p ON p.id = a.project_id
      WHERE p.user_id = ${auth.userId}
        AND (c.status_code < 200 OR c.status_code >= 400)
      ORDER BY c.checked_at DESC
      LIMIT 25
    `;

    return NextResponse.json({
      summary: {
        total: apis.length,
        up: upCount,
        down: downCount,
        uptimePercent: overallUptime,
        avgLatencyMs: avgGlobalLatency,
        systemStatus,
      },
      services,
      incidents,
    });
  } catch (error: any) {
    console.error('Monitor status error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch monitoring status' },
      { status: 500 }
    );
  }
}

