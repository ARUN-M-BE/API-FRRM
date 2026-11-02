export interface Env {
  APP_URL: string;
  CRON_SECRET?: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const url = `${env.APP_URL.replace(/\/+$/, '')}/api/cron/check`;
    console.log(`[Monitor Worker] Triggered cron at ${new Date(event.scheduledTime).toISOString()}. Calling ${url}...`);

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'API-FRRM-Monitor-Worker/1.0',
      };
      if (env.CRON_SECRET) {
        headers['x-cron-secret'] = env.CRON_SECRET;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
      });

      const responseText = await res.text();
      console.log(`[Monitor Worker] Check responded with status ${res.status}:`, responseText);
    } catch (err) {
      console.error('[Monitor Worker] Failed to run cron health check:', err);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response(
      JSON.stringify({
        service: 'api-frrm-monitor',
        status: 'active',
        app_url: env.APP_URL,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};

