import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { sql } from '@/lib/db';
import { notifyChannels } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const { api_id = null } = body;

    let apis;
    if (api_id) {
      apis = await sql<
        {
          id: string;
          project_id: string;
          project_name: string;
          api_key: string;
          name: string;
          version: string;
          check_url: string | null;
          is_up: boolean | null;
        }[]
      >`
        SELECT a.id, a.project_id, a.name, a.version, a.check_url, a.is_up,
               p.name AS project_name, p.api_key
        FROM apis a
        JOIN projects p ON p.id = a.project_id
        WHERE a.id = ${api_id} AND p.user_id = ${auth.userId}
        LIMIT 1
      `;
    } else {
      apis = await sql<
        {
          id: string;
          project_id: string;
          project_name: string;
          api_key: string;
          name: string;
          version: string;
          check_url: string | null;
          is_up: boolean | null;
        }[]
      >`
        SELECT a.id, a.project_id, a.name, a.version, a.check_url, a.is_up,
               p.name AS project_name, p.api_key
        FROM apis a
        JOIN projects p ON p.id = a.project_id
        WHERE p.user_id = ${auth.userId}
        ORDER BY p.name ASC, a.name ASC
      `;
    }

    if (!apis || apis.length === 0) {
      return NextResponse.json({ message: 'No APIs found to check', checked: 0, results: [] });
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const appUrl = `${protocol}://${host}`;

    const results = [];

    for (const api of apis) {
      const startTime = performance.now();
      let statusCode = 0;
      let latencyMs = 0;

      // Determine check target
      let targetUrl = api.check_url?.trim();
      const headers: Record<string, string> = {
        'User-Agent': 'API-FRRM-Monitor/1.0',
      };

      if (!targetUrl) {
        // Fallback to internal API endpoint with project API key
        targetUrl = `${appUrl}/api/p/${api.project_name}/${api.version}/${api.name}?limit=1`;
        headers['x-api-key'] = api.api_key;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(targetUrl, {
          method: 'GET',
          signal: controller.signal,
          headers,
        });
        clearTimeout(timeoutId);

        statusCode = res.status;
        latencyMs = Math.round(performance.now() - startTime);
      } catch (err: any) {
        latencyMs = Math.round(performance.now() - startTime);
        statusCode = 504;
      }

      const isUp = statusCode >= 200 && statusCode < 400;

      // Record check into api_checks
      await sql`
        INSERT INTO api_checks (api_id, status_code, latency_ms)
        VALUES (${api.id}, ${statusCode}, ${latencyMs})
      `;

      // Check state change
      const previousState = api.is_up;
      const stateChanged = previousState !== null && previousState !== isUp;

      await sql`
        UPDATE apis
        SET is_up = ${isUp}, last_checked_at = now()
        WHERE id = ${api.id}
      `;

      if (stateChanged) {
        const statusEmoji = isUp ? '✅ [RECOVERED]' : '🚨 [ALERT - DOWN]';
        const msg = `${statusEmoji} API "${api.name}" (${api.version}) in project "${api.project_name}" is now ${
          isUp ? 'UP' : 'DOWN'
        }!\nStatus Code: ${statusCode}\nLatency: ${latencyMs}ms\nURL: ${targetUrl}`;

        notifyChannels(api.project_id, msg).catch((err) =>
          console.error('Notification dispatch error:', err)
        );
      }

      results.push({
        api_id: api.id,
        project_name: api.project_name,
        api_name: api.name,
        version: api.version,
        target_url: targetUrl,
        is_up: isUp,
        status_code: statusCode,
        latency_ms: latencyMs,
        checked_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      message: `Successfully checked ${results.length} service(s)`,
      checked: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Check now error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute health check' },
      { status: 500 }
    );
  }
}

