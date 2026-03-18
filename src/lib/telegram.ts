/**
 * Minimal Telegram Bot API client.
 * No external dependencies — uses native fetch.
 */

const TELEGRAM_API = "https://api.telegram.org";

export interface TelegramSendOptions {
  botToken: string;
  chatId: string;
  topicId?: string | null;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
}

export interface TelegramResult {
  ok: boolean;
  error?: string;
}

/**
 * Send a message to a Telegram chat (optionally to a specific topic/thread).
 */
export async function sendTelegramMessage(
  opts: TelegramSendOptions,
): Promise<TelegramResult> {
  const { botToken, chatId, topicId, text, parseMode = "HTML" } = opts;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  };

  if (topicId) {
    body.message_thread_id = Number(topicId);
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const desc = (data as Record<string, string>).description ?? `HTTP ${res.status}`;
      return { ok: false, error: desc };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: msg };
  }
}
