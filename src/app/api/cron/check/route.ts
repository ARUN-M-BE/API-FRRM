import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { notifyChannels } from '@/lib/notifications';
import { getEnv } from '@/lib/env';

export async function GET(request: Request) {
  return handleCheck(request);
}

export async function POST(request: Request) {
  return handleCheck(request);
}

async function handleCheck(request: Request) {
  try {
    const cronSecret = getEnv('CRON_SECRET');
    const providedSecret = request.headers.get('x-cron-secret');

    if (cronSecret && providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized. Invalid x-cron-secret.' }, { status: 401 });
    }

    // Fetch all APIs across all projects
    const apis = await sql<
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
    `;

    if (!apis || apis.length === 0) {
      return NextResponse.json({ message: 'No APIs found for health checks', checked: 0 });
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const appUrl = getEnv('APP_URL') || `${protocol}://${host}`;

    const results = [];

    for (const api of apis) {
      const startTime = performance.now();
      let statusCode = 0;
      let latencyMs = 0;

      // Determine check URL: user-specified check_url OR automated ping to API's own CRUD route
      let targetUrl = api.check_url?.trim();
      const headers: Record<string, string> = {
        'User-Agent': 'API-FRRM-Monitor/1.0',
      };

      if (!targetUrl) {
        targetUrl = `${appUrl}/api/p/${api.project_name}/${api.version}/${api.name}?limit=1`;
        headers['x-api-key'] = api.api_key;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
        statusCode = 504; // Gateway / Connection timeout
      }

      const isUp = statusCode >= 200 && statusCode < 400;

      // Record check into api_checks table
      await sql`
        INSERT INTO api_checks (api_id, status_code, latency_ms)
        VALUES (${api.id}, ${statusCode}, ${latencyMs})
      `;

      // Check for state change
      const previousState = api.is_up;
      const stateChanged = previousState !== null && previousState !== isUp;

      // Update API record
      await sql`
        UPDATE apis
        SET is_up = ${isUp}, last_checked_at = now()
        WHERE id = ${api.id}
      `;

      if (stateChanged) {
        const statusEmoji = isUp ? '✅ [RECOVERED]' : '🚨 [ALERT - DOWN]';
        const msg = `${statusEmoji} API "${api.name}" (${api.version}) in project "${api.project_name}" is now ${
          isUp ? 'UP' : 'DOWN'
        }!\nStatus Code: ${statusCode}\nLatency: ${latencyMs}ms\nTarget: ${targetUrl}`;

        // Fire and forget notification
        notifyChannels(api.project_id, msg).catch((err) =>
          console.error('Notification dispatch error:', err)
        );
      }

      results.push({
        api_id: api.id,
        api_name: api.name,
        project_name: api.project_name,
        target_url: targetUrl,
        statusCode,
        latencyMs,
        isUp,
        stateChanged,
      });
    }

    // Auto-cleanup checks older than 14 days
    try {
      await sql`
        DELETE FROM api_checks
        WHERE checked_at < now() - interval '14 days'
      `;
    } catch (cleanupErr) {
      console.error('Failed to cleanup old api_checks:', cleanupErr);
    }

    return NextResponse.json({
      message: 'Health checks completed',
      checked: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Cron check handler error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute health checks' },
      { status: 500 }
    );
  }
}
