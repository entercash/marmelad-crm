"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { syncKeitaroCampaigns } from "../actions";
import type { SyncCampaignsResult } from "../actions";

export function SyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult]   = useState<SyncCampaignsResult | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);

    const res = await syncKeitaroCampaigns();
    setResult(res);
    setSyncing(false);

    if (res.success) {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" onClick={handleSync} disabled={syncing}>
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Campaigns"}
      </Button>

      {result && (
        <span
          className={`flex items-center gap-1.5 text-xs ${
            result.success ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {result.success ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {result.total} campaigns ({result.created} new, {result.updated} updated{result.deleted > 0 ? `, ${result.deleted} deleted` : ""})
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              {result.error}
            </>
          )}
        </span>
      )}
    </div>
  );
}
