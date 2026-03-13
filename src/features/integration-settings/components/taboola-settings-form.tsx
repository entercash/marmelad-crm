"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Unplug } from "lucide-react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import {
  saveTaboolaAccountSettings,
  testTaboolaAccountConnection,
  disconnectTaboolaAccount,
} from "../actions";
import type { TestConnectionResult } from "../actions";

// ─── Props ──────────────────────────────────────────────────────────────────

export type TaboolaAccountOption = {
  id: string;
  name: string;
  externalId: string | null;
  connected: boolean;
  clientId: string;
  clientSecret: string;
  proxyUrl: string;
};

interface TaboolaSettingsFormProps {
  accounts: TaboolaAccountOption[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TaboolaSettingsForm({ accounts }: TaboolaSettingsFormProps) {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? "");
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  // Current account data
  const current = accounts.find((a) => a.id === selectedId);

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
    formData.set("accountId", selectedId);
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

    const result = await testTaboolaAccountConnection(selectedId);
    setTestResult(result);
    setTesting(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    clearMessages();

    const result = await disconnectTaboolaAccount(selectedId);
    setDisconnecting(false);
    if (result.success) {
      setSuccess("Account disconnected");
    } else {
      setError(result.error);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No Taboola accounts found. Add accounts on the Ad Accounts page first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {success}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            testResult.success
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Connection successful — {testResult.campaignCount} campaigns found
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              {testResult.error}
            </>
          )}
        </div>
      )}

      {/* Account selector */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="taboola-account">Account</Label>
        <select
          id="taboola-account"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            clearMessages();
          }}
          className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.externalId ? ` (${a.externalId})` : ""}
              {a.connected ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Client ID */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientId">Client ID *</Label>
        <Input
          id="clientId"
          name="clientId"
          type="text"
          placeholder="Enter Taboola Client ID"
          required
          key={`clientId-${selectedId}`}
          defaultValue={current?.clientId ?? ""}
        />
      </div>

      {/* Client Secret */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientSecret">Client Secret *</Label>
        <Input
          id="clientSecret"
          name="clientSecret"
          type="password"
          placeholder="Enter Taboola Client Secret"
          required
          key={`clientSecret-${selectedId}`}
          defaultValue={current?.clientSecret ?? ""}
        />
        <p className="text-xs text-slate-500">
          Found in Taboola Backstage: Settings &rarr; Account Management &rarr; API
        </p>
      </div>

      {/* Proxy URL */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proxyUrl">Proxy URL (optional)</Label>
        <Input
          id="proxyUrl"
          name="proxyUrl"
          type="text"
          placeholder="http://user:pass@proxy:port"
          key={`proxyUrl-${selectedId}`}
          defaultValue={current?.proxyUrl ?? ""}
        />
        <p className="text-xs text-slate-500">
          HTTP/HTTPS proxy for API requests. Leave empty for direct connection.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <Button type="submit" size="sm" disabled={saving || testing || disconnecting}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={saving || testing || disconnecting}
        >
          {testing ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
        {current?.connected && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={saving || testing || disconnecting}
            className="text-red-400 hover:text-red-300"
          >
            {disconnecting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                <Unplug className="mr-1.5 h-3.5 w-3.5" />
                Disconnect
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
