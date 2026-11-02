import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { notifyChannels } from '@/lib/notifications';

export async function GET(request: Request) {
  return handleCheck(request);
}

export async function POST(request: Request) {
  return handleCheck(request);
}

async function handleCheck(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = request.headers.get('x-cron-secret');

    if (cronSecret && providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized. Invalid x-cron-secret.' }, { status: 401 });
    }

    // Fetch all APIs with a check_url configured
    const apis = await sql<
      {
        id: string;
        project_id: string;
        project_name: string;
        name: string;
        version: string;
        check_url: string;
        is_up: boolean | null;
      }[]
    >`
      SELECT a.id, a.project_id, a.name, a.version, a.check_url, a.is_up,
             p.name AS project_name
      FROM apis a
      JOIN projects p ON p.id = a.project_id
      WHERE a.check_url IS NOT NULL AND a.check_url != ''
    `;

    if (!apis || apis.length === 0) {
      return NextResponse.json({ message: 'No APIs configured for health checks', checked: 0 });
    }

    const results = [];

    for (const api of apis) {
      const startTime = performance.now();
      let statusCode = 0;
      let latencyMs = 0;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(api.check_url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'API-FRRM-Monitor/1.0',
          },
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
        }!\nStatus Code: ${statusCode}\nLatency: ${latencyMs}ms\nURL: ${api.check_url}`;

        // Fire and forget notification
        notifyChannels(api.project_id, msg).catch((err) =>
          console.error('Notification dispatch error:', err)
        );
      }

      results.push({
        id: api.id,
        name: api.name,
        is_up: isUp,
        status_code: statusCode,
        latency_ms: latencyMs,
        state_changed: stateChanged,
      });
    }

    // Retention cleanup: purge records older than 14 days
    try {
      await sql`DELETE FROM api_checks WHERE checked_at < now() - INTERVAL '14 days'`;
    } catch (cleanupErr) {
      console.warn('Old check logs cleanup error:', cleanupErr);
    }

    return NextResponse.json({
      message: 'Health checks completed',
      checked_count: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Cron check handler error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

