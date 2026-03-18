"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Unplug } from "lucide-react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";

import {
  saveGoogleSettings,
  disconnectGoogle,
} from "../actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GoogleConnectionProps {
  safeBrowsingApiKey: string;
  configured: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GoogleConnection({ safeBrowsingApiKey, configured }: GoogleConnectionProps) {
  const [saving, setSaving]             = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    clearMessages();

    const formData = new FormData(e.currentTarget);
    const result = await saveGoogleSettings(formData);

    setSaving(false);
    if (result.success) {
      setSuccess("API Key saved");
    } else {
      setError(result.error);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    clearMessages();
    const result = await disconnectGoogle();
    setDisconnecting(false);
    if (!result.success) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h3 className="text-base font-medium text-white">Google</h3>
        <Badge variant={configured ? "default" : "secondary"}>
          {configured ? "Connected" : "Not connected"}
        </Badge>
      </div>

      <p className="text-sm text-slate-400">
        Connect Google Safe Browsing API to check domains for malware, phishing, and scam flags.
        Get your API key from{" "}
        <a
          href="https://console.cloud.google.com/apis/api/safebrowsing.googleapis.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300"
        >
          Google Cloud Console
        </a>
        {" "}(free, 10k lookups/day).
      </p>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="google-sb-key">Safe Browsing API Key</Label>
          <Input
            id="google-sb-key"
            name="safeBrowsingApiKey"
            type="password"
            defaultValue={safeBrowsingApiKey}
            placeholder="Enter Google Safe Browsing API key"
            className="max-w-lg"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save
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
    </div>
  );
}
