import { sql } from './db';

export async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch (err) {
    console.error('Telegram notification error:', err);
    return false;
  }
}

export async function sendSlackWebhook(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch (err) {
    console.error('Slack webhook error:', err);
    return false;
  }
}

export async function sendDiscordWebhook(webhookUrl: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return res.ok;
  } catch (err) {
    console.error('Discord webhook error:', err);
    return false;
  }
}

export async function sendResendEmail(
  apiKey: string,
  to: string,
  subject: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'API-FRRM Alerts <alerts@resend.dev>',
        to: [to],
        subject,
        text,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Resend email error:', err);
    return false;
  }
}

export async function notifyChannels(projectId: string, message: string): Promise<void> {
  try {
    const channels = await sql<
      { id: string; type: string; target: string }[]
    >`SELECT id, type, target FROM notify_channels WHERE project_id = ${projectId}`;

    if (!channels || channels.length === 0) return;

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const resendApiKey = process.env.RESEND_API_KEY;

    await Promise.allSettled(
      channels.map(async (ch) => {
        switch (ch.type) {
          case 'telegram':
            if (telegramToken) {
              await sendTelegram(telegramToken, ch.target, message);
            }
            break;
          case 'slack':
            await sendSlackWebhook(ch.target, message);
            break;
          case 'discord':
            await sendDiscordWebhook(ch.target, message);
            break;
          case 'email':
            if (resendApiKey) {
              await sendResendEmail(resendApiKey, ch.target, 'API Status Alert - API-FRRM', message);
            }
            break;
        }
      })
    );
  } catch (err) {
    console.error('Failed to notify channels:', err);
  }
}

