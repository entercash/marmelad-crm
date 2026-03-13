"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { saveKeitaroSettings, testKeitaroConnection } from "../actions";
import type { TestConnectionResult } from "../actions";

// ─── Props ──────────────────────────────────────────────────────────────────

interface KeitaroSettingsFormProps {
  initialApiUrl: string;
  initialApiKey: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function KeitaroSettingsForm({
  initialApiUrl,
  initialApiKey,
}: KeitaroSettingsFormProps) {
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    const formData = new FormData(e.currentTarget);
    const result = await saveKeitaroSettings(formData);

    setSaving(false);

    if (result.success) {
      setSuccess("Settings saved");
    } else {
      setError(result.error);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    const result = await testKeitaroConnection();
    setTestResult(result);
    setTesting(false);
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

      {/* API URL */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apiUrl">Keitaro API URL *</Label>
        <Input
          id="apiUrl"
          name="apiUrl"
          type="text"
          placeholder="https://tracker.yourdomain.com"
          required
          defaultValue={initialApiUrl}
        />
        <p className="text-xs text-slate-500">
          Your Keitaro tracker URL (without trailing slash)
        </p>
      </div>

      {/* API Key */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apiKey">API Key *</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          placeholder="Enter API key"
          required
          defaultValue={initialApiKey}
        />
        <p className="text-xs text-slate-500">
          Found in Keitaro: Maintenance &rarr; Users &rarr; Admin API Keys
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <Button type="submit" size="sm" disabled={saving || testing}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={saving || testing}
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
      </div>
    </form>
  );
}
