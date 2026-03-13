"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Unplug, ChevronDown, ChevronUp } from "lucide-react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";

import {
  saveTaboolaAccountSettings,
  testTaboolaAccountConnection,
  disconnectTaboolaAccount,
} from "../actions";
import type { TestConnectionResult } from "../actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaboolaAccountOption = {
  id: string;
  name: string;
  externalId: string | null;
  connected: boolean;
  clientId: string;
  clientSecret: string;
  proxyUrl: string;
};

interface TaboolaConnectionsListProps {
  accounts: TaboolaAccountOption[];
}

// ─── Account Row ────────────────────────────────────────────────────────────

function AccountRow({ account }: { account: TaboolaAccountOption }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  function clearMessages() {
    setError(null);
    setSuccess(null);
    setTestResult(null);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    clearMessages();

    const formData = new FormData(e.currentTarget);
    formData.set("accountId", account.id);
    const result = await saveTaboolaAccountSettings(formData);

    setSaving(false);
    if (result.success) {
      setSuccess("Credentials saved");
    } else {
      setError(result.error);
    }
  }

  async function handleTest() {
    setTesting(true);
    clearMessages();
    const result = await testTaboolaAccountConnection(account.id);
    setTestResult(result);
    setTesting(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    clearMessages();
    const result = await disconnectTaboolaAccount(account.id);
    setDisconnecting(false);
    if (result.success) {
      setSuccess("Disconnected");
    } else {
      setError(result.error);
    }
  }

  const busy = saving || testing || disconnecting;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
      {/* Header row */}
      <button
        type="button"
        onClick={() => { setExpanded(!expanded); clearMessages(); }}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{account.name}</span>
          {account.externalId && (
            <span className="text-xs text-slate-500">{account.externalId}</span>
          )}
          {account.connected ? (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="border-slate-500/30 text-slate-500 text-[10px]">
              Not connected
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {/* Expanded form */}
      {expanded && (
        <form onSubmit={handleSave} className="border-t border-white/[0.06] px-4 py-4 flex flex-col gap-3">
          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {success}
            </div>
          )}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              testResult.success
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}>
              {testResult.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Connection successful — {testResult.campaignCount} campaigns
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  {testResult.error}
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`clientId-${account.id}`}>Client ID</Label>
              <Input
                id={`clientId-${account.id}`}
                name="clientId"
                type="text"
                placeholder="Client ID"
                required
                defaultValue={account.clientId}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`clientSecret-${account.id}`}>Client Secret</Label>
              <Input
                id={`clientSecret-${account.id}`}
                name="clientSecret"
                type="password"
                placeholder="Client Secret"
                required
                defaultValue={account.clientSecret}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`proxyUrl-${account.id}`}>Proxy URL (optional)</Label>
            <Input
              id={`proxyUrl-${account.id}`}
              name="proxyUrl"
              type="text"
              placeholder="http://user:pass@proxy:port"
              defaultValue={account.proxyUrl}
            />
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <Button type="submit" size="sm" disabled={busy}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={busy}>
              {testing ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Testing...</>
              ) : "Test Connection"}
            </Button>
            {account.connected && (
              <Button
                type="button" variant="outline" size="sm"
                onClick={handleDisconnect} disabled={busy}
                className="text-red-400 hover:text-red-300"
              >
                {disconnecting ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Disconnecting...</>
                ) : (
                  <><Unplug className="mr-1.5 h-3.5 w-3.5" />Disconnect</>
                )}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

// ─── List Component ─────────────────────────────────────────────────────────

export function TaboolaConnectionsList({ accounts }: TaboolaConnectionsListProps) {
  if (accounts.length === 0) {
    return (
      <div className="glass p-5">
        <p className="text-sm text-slate-400">
          No Taboola accounts found. Add accounts on the Ad Accounts page first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        Configure API credentials for each Taboola account. Click an account to expand.
      </p>
      {accounts.map((account) => (
        <AccountRow key={account.id} account={account} />
      ))}
    </div>
  );
}
