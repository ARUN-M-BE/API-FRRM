import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';
import { discoverAllApis } from '@/lib/discovery';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const baseUrl = `${protocol}://${host}`;

    const apis = await discoverAllApis(auth.userId, baseUrl);

    // Fetch user's alert events
    const alertEvents = await sql<
      {
        id: string;
        api_id: string | null;
        api_name: string;
        endpoint: string;
        event_type: 'FAILURE' | 'RECOVERY' | 'DEGRADED';
        status_code: number | null;
        latency_ms: number | null;
        message: string;
        created_at: string;
      }[]
    >`
      SELECT id, api_id, api_name, endpoint, event_type, status_code, latency_ms, message, created_at
      FROM alert_events
      WHERE user_id = ${auth.userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Fetch recent check trends (last 24 hours / 7 days)
    const apiIds = apis.filter((a) => a.project_id).map((a) => a.id.split('-')[0]);
    const uniqueApiIds = Array.from(new Set(apiIds));

    let latencyTrendPoints: { time: string; latency_ms: number; passed: boolean }[] = [];
    let successCount = 0;
    let failureCount = 0;

    if (uniqueApiIds.length > 0) {
      const checks = await sql<
        {
          status_code: number;
          latency_ms: number;
          checked_at: string;
        }[]
      >`
        SELECT status_code, latency_ms, checked_at
        FROM api_checks
        WHERE api_id = ANY(${uniqueApiIds})
        ORDER BY checked_at ASC
        LIMIT 200
      `;

      latencyTrendPoints = checks.map((c) => {
        const isSuccess = c.status_code >= 200 && c.status_code < 400;
        if (isSuccess) successCount++;
        else failureCount++;
        return {
          time: new Date(c.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          latency_ms: c.latency_ms,
          passed: isSuccess,
        };
      });
    }

    const healthyCount = apis.filter((a) => a.status === 'Healthy').length;
    const degradedCount = apis.filter((a) => a.status === 'Degraded').length;
    const downCount = apis.filter((a) => a.status === 'Down').length;
    const unknownCount = apis.filter((a) => a.status === 'Unknown').length;

    const latencies = apis.filter((a) => a.latest_latency_ms !== null).map((a) => a.latest_latency_ms!);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    const totalCalls = successCount + failureCount;
    const overallSuccessRate = totalCalls > 0 ? Math.round((successCount / totalCalls) * 1000) / 10 : 100;

    return NextResponse.json({
      summary: {
        totalApis: apis.length,
        healthy: healthyCount,
        degraded: degradedCount,
        down: downCount,
        unknown: unknownCount,
        avgLatencyMs: avgLatency,
        overallSuccessRate,
        totalChecksLogged: totalCalls,
      },
      distribution: [
        { label: 'Healthy', count: healthyCount, color: '#10b981' },
        { label: 'Degraded', count: degradedCount, color: '#f59e0b' },
        { label: 'Down', count: downCount, color: '#f43f5e' },
        { label: 'Unknown', count: unknownCount, color: '#6b7280' },
      ],
      latencyTrends: latencyTrendPoints,
      alerts: alertEvents,
    });
  } catch (err: any) {
    console.error('Analytics fetch error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
