import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { discoverAllApis } from '@/lib/discovery';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const baseUrl = `${protocol}://${host}`;

    const apis = await discoverAllApis(auth.userId, baseUrl);

    // Summary counts
    const total = apis.length;
    const healthy = apis.filter((a) => a.status === 'Healthy').length;
    const degraded = apis.filter((a) => a.status === 'Degraded').length;
    const down = apis.filter((a) => a.status === 'Down').length;
    const unknown = apis.filter((a) => a.status === 'Unknown').length;

    const latencies = apis.filter((a) => a.latest_latency_ms !== null).map((a) => a.latest_latency_ms!);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    const uptimes = apis.map((a) => a.uptime_percent);
    const avgUptime = uptimes.length > 0 ? Math.round((uptimes.reduce((a, b) => a + b, 0) / uptimes.length) * 10) / 10 : 100;

    return NextResponse.json({
      summary: {
        total,
        healthy,
        degraded,
        down,
        unknown,
        avgLatencyMs: avgLatency,
        avgUptimePercent: avgUptime,
      },
      apis,
    });
  } catch (err: any) {
    console.error('Discover APIs error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to discover APIs' },
      { status: 500 }
    );
  }
}
