"use server";

import { guardWrite } from "@/lib/auth-guard";

const S2S_BASE = "http://trc.taboola.com/actions-handler/log/3/s2s-action";

export type PostbackResult = {
  clickId: string;
  status: "ok" | "error";
  httpCode?: number;
  error?: string;
};

export type SendPostbacksResult =
  | { success: true; results: PostbackResult[] }
  | { success: false; error: string };

export async function sendPostbacks(
  clickIds: string[],
  eventName: string,
  revenue?: string,
): Promise<SendPostbacksResult> {
  const denied = await guardWrite();
  if (denied) {
    const err = !denied.success ? denied.error : "Access denied";
    return { success: false, error: err };
  }

  if (clickIds.length === 0) {
    return { success: false, error: "No click IDs provided" };
  }
  if (!eventName.trim()) {
    return { success: false, error: "Event name is required" };
  }
  if (clickIds.length > 500) {
    return { success: false, error: "Maximum 500 click IDs per batch" };
  }

  const results = await Promise.allSettled(
    clickIds.map(async (clickId): Promise<PostbackResult> => {
      const params = new URLSearchParams({
        "click-id": clickId,
        name: eventName.trim(),
      });
      if (revenue?.trim()) {
        params.set("revenue", revenue.trim());
      }

      const url = `${S2S_BASE}?${params.toString()}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        });

        if (res.ok) {
          return { clickId, status: "ok", httpCode: res.status };
        }
        return {
          clickId,
          status: "error",
          httpCode: res.status,
          error: `HTTP ${res.status}`,
        };
      } catch (err) {
        return {
          clickId,
          status: "error",
          error: err instanceof Error ? err.message : "Network error",
        };
      }
    }),
  );

  return {
    success: true,
    results: results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { clickId: "unknown", status: "error" as const, error: r.reason?.message ?? "Failed" },
    ),
  };
}
