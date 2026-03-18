/**
 * Telegram Alert Notifications
 *
 * Sends system alerts (low balance, sync errors, etc.) to the alerts topic.
 * Can be called from any service or job handler.
 *
 * Balance alerts use Redis keys with no TTL — they persist until the balance
 * rises above the threshold, at which point the key is deleted.
 */

import { sendTelegramMessage } from "@/lib/telegram";
import { getTelegramSettings } from "@/features/integration-settings/queries";
import { getAccounts } from "@/features/ad-accounts/queries";

// ─── Generic alert sender ────────────────────────────────────────────────────

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

// ─── Redis helpers ───────────────────────────────────────────────────────────

async function getRedis() {
  const { redis } = await import("@/lib/redis");
  return redis;
}

function alertKey(accountId: string, threshold: number): string {
  return `telegram:alert:balance:${accountId}:${threshold}`;
}

// ─── Balance alerts ──────────────────────────────────────────────────────────

const THRESHOLDS = [
  { amount: 3000, emoji: "⚠️", label: "Low Balance" },
  { amount: 1000, emoji: "🔴", label: "Critical Balance" },
] as const;

/**
 * Check all account balances and send alerts when remaining drops below
 * $3,000 or $1,000. Each alert fires once per threshold per account.
 * When balance rises above a threshold, the flag is cleared so it can
 * fire again if balance drops again.
 */
export async function checkBalanceAlerts(): Promise<number> {
  let sent = 0;

  let redis;
  try {
    redis = await getRedis();
  } catch {
    return 0;
  }

  const accounts = await getAccounts();

  for (const account of accounts) {
    // Skip accounts with no activity
    if (account.totalTopUp === 0 && account.rawSpentUsd === 0) continue;

    for (const threshold of THRESHOLDS) {
      const key = alertKey(account.id, threshold.amount);

      if (account.remaining < threshold.amount) {
        // Check if we already sent this alert
        const alreadySent = await redis.get(key);
        if (alreadySent) continue;

        const remaining = account.remaining < 0
          ? `-$${Math.abs(account.remaining).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `$${account.remaining.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const accountLabel = account.agencyName
          ? `${account.agencyName} — ${account.name}`
          : account.name;

        const lines = [
          `${threshold.emoji} <b>${threshold.label}</b>`,
          `Account: ${accountLabel}`,
          `Remaining: ${remaining}`,
        ];

        const ok = await sendAlert(lines.join("\n"));
        if (ok) {
          // Mark as sent — no TTL, cleared when balance recovers
          await redis.set(key, "1");
          sent++;
        }
      } else {
        // Balance is above threshold — clear the flag so it fires again if it drops
        await redis.del(key);
      }
    }
  }

  if (sent > 0) {
    console.log(`[telegram-alerts] Sent ${sent} balance alerts`);
  }

  return sent;
}
