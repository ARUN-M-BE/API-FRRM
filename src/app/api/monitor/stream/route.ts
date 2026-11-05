import { requireAuth } from '@/lib/middleware';
import { discoverAllApis } from '@/lib/discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${protocol}://${host}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed by client
        }
      };

      try {
        // Initial state event
        const apis = await discoverAllApis(auth.userId, baseUrl);
        sendEvent('init', {
          timestamp: new Date().toISOString(),
          apis,
          summary: {
            total: apis.length,
            healthy: apis.filter((a) => a.status === 'Healthy').length,
            degraded: apis.filter((a) => a.status === 'Degraded').length,
            down: apis.filter((a) => a.status === 'Down').length,
          },
        });

        // Ping heartbeat every 10 seconds
        const interval = setInterval(async () => {
          try {
            const updatedApis = await discoverAllApis(auth.userId, baseUrl);
            sendEvent('ping', {
              timestamp: new Date().toISOString(),
              summary: {
                total: updatedApis.length,
                healthy: updatedApis.filter((a) => a.status === 'Healthy').length,
                degraded: updatedApis.filter((a) => a.status === 'Degraded').length,
                down: updatedApis.filter((a) => a.status === 'Down').length,
              },
            });
          } catch {
            clearInterval(interval);
          }
        }, 10000);

        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          try {
            controller.close();
          } catch {}
        });
      } catch (err: any) {
        sendEvent('error', { error: err.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
