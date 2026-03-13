"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Unplug } from "lucide-react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";

import {
  saveAdspectSettings,
  testAdspectConnection,
  disconnectAdspect,
} from "../actions";
import type { TestConnectionResult } from "../actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdspectConnectionProps {
  apiKey: string;
  configured: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdspectConnection({ apiKey, configured }: AdspectConnectionProps) {
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
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
    const result = await saveAdspectSettings(formData);

    setSaving(false);
    if (result.success) {
      setSuccess("API Key saved");
    } else {
      setError(result.error);
    }
  }

  async function handleTest() {
    setTesting(true);
    clearMessages();
    const result = await testAdspectConnection();
    setTestResult(result);
    setTesting(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    clearMessages();
    const result = await disconnectAdspect();
    setDisconnecting(false);
    if (!result.success) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h3 className="text-base font-medium text-white">Adspect</h3>
        <Badge variant={configured ? "default" : "secondary"}>
          {configured ? "Connected" : "Not connected"}
        </Badge>
      </div>

      <p className="text-sm text-slate-400">
        Connect your Adspect account to track bot traffic and filter quality per publisher.
        Get your API key from{" "}
        <a
          href="https://clients.adspect.ai/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300"
        >
          Adspect settings
        </a>.
      </p>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adspect-api-key">API Key</Label>
          <Input
            id="adspect-api-key"
            name="apiKey"
            type="password"
            defaultValue={apiKey}
            placeholder="Enter Adspect API key"
            className="max-w-lg"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testing || !configured}
            onClick={handleTest}
          >
            {testing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>

          {configured && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              disabled={disconnecting}
              onClick={handleDisconnect}
            >
              {disconnecting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-1.5 h-4 w-4" />
              )}
              Disconnect
            </Button>
          )}
        </div>
      </form>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {testResult && (
        <div
          className={`flex items-center gap-2 text-sm ${
            testResult.success ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Connection OK — {testResult.campaignCount} stream{testResult.campaignCount !== 1 ? "s" : ""} found
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {testResult.error}
            </>
          )}
        </div>
      )}
    </div>
  );
}
