/**
 * Telegram Alert Notifications
 *
 * Sends system alerts (low balance, sync errors, etc.) to the alerts topic.
 * Can be called from any service or job handler.
 */

import { sendTelegramMessage } from "@/lib/telegram";
import { getTelegramSettings } from "@/features/integration-settings/queries";

/**
 * Send an alert message to the Telegram alerts topic.
 * Returns true if sent successfully, false if not configured or failed.
 */
export async function sendAlert(text: string): Promise<boolean> {
  const settings = await getTelegramSettings();

  if (!settings.botToken || !settings.chatId || !settings.alertsTopicId) {
    return false;
  }

  const result = await sendTelegramMessage({
    botToken: settings.botToken,
    chatId: settings.chatId,
    topicId: settings.alertsTopicId,
    text,
  });

  if (!result.ok) {
    console.error("[telegram-alerts] Failed to send alert:", result.error);
    return false;
  }

  return true;
}
