"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Trash2, Plus, ChevronDown, ChevronUp, Copy, RefreshCw } from "lucide-react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";

import {
  saveKeitaroInstance,
  testKeitaroInstance,
  deleteKeitaroInstance,
  regeneratePostbackToken,
} from "../actions";
import type { TestConnectionResult } from "../actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export type KeitaroInstanceOption = {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  configured: boolean; // has both apiUrl + apiKey
};

interface KeitaroConnectionsListProps {
  instances: KeitaroInstanceOption[];
}

// ─── Instance Row ───────────────────────────────────────────────────────────

function InstanceRow({ instance }: { instance: KeitaroInstanceOption }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    formData.set("instanceId", instance.id);
    const result = await saveKeitaroInstance(formData);

    setSaving(false);
    if (result.success) {
      setSuccess("Settings saved");
    } else {
      setError(result.error);
    }
  }

  async function handleTest() {
    setTesting(true);
    clearMessages();
    const result = await testKeitaroInstance(instance.id);
    setTestResult(result);
    setTesting(false);
  }

  async function handleDelete() {
    setDeleting(true);
    clearMessages();
    const result = await deleteKeitaroInstance(instance.id);
    setDeleting(false);
    if (!result.success) {
      setError(result.error);
    }
  }

  const busy = saving || testing || deleting;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => { setExpanded(!expanded); clearMessages(); }}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{instance.name || "Unnamed"}</span>
          {instance.apiUrl && (
            <span className="text-xs text-slate-500">{instance.apiUrl}</span>
          )}
          {instance.configured ? (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
              Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
              Incomplete
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

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
                <><CheckCircle2 className="h-4 w-4" />{testResult.campaignCount} campaigns found</>
              ) : (
                <><AlertCircle className="h-4 w-4" />{testResult.error}</>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`name-${instance.id}`}>Name</Label>
            <Input id={`name-${instance.id}`} name="name" type="text" placeholder="My Keitaro" required defaultValue={instance.name} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`apiUrl-${instance.id}`}>API URL</Label>
            <Input id={`apiUrl-${instance.id}`} name="apiUrl" type="text" placeholder="https://tracker.yourdomain.com" required defaultValue={instance.apiUrl} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`apiKey-${instance.id}`}>API Key</Label>
            <Input id={`apiKey-${instance.id}`} name="apiKey" type="password" placeholder="API key" required defaultValue={instance.apiKey} />
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
            <Button
              type="button" variant="outline" size="sm"
              onClick={handleDelete} disabled={busy}
              className="text-red-400 hover:text-red-300"
            >
              {deleting ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Deleting...</>
              ) : (
                <><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Add New Form ───────────────────────────────────────────────────────────

function AddKeitaroForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    // No instanceId → action will generate one
    const result = await saveKeitaroInstance(formData);

    setSaving(false);
    if (result.success) {
      setSuccess("Keitaro instance added");
      setOpen(false);
    } else {
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Keitaro
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.03] p-4">
      <h4 className="mb-3 text-sm font-medium text-white">New Keitaro Instance</h4>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-keitaro-name">Name *</Label>
          <Input id="new-keitaro-name" name="name" type="text" placeholder="My Keitaro" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-keitaro-apiUrl">API URL *</Label>
          <Input id="new-keitaro-apiUrl" name="apiUrl" type="text" placeholder="https://tracker.yourdomain.com" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-keitaro-apiKey">API Key *</Label>
          <Input id="new-keitaro-apiKey" name="apiKey" type="password" placeholder="API key" required />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Adding..." : "Add"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(false); setError(null); }}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── List Component ─────────────────────────────────────────────────────────

// ─── Postback URL Section ───────────────────────────────────────────────────

function PostbackUrlSection({ postbackToken }: { postbackToken: string | null }) {
  const [token, setToken] = useState(postbackToken);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://marmelad-crm.com";
  const postbackUrl = token
    ? `${baseUrl}/api/postback/keitaro?token=${token}&campaign_name={campaign_name}&site={site}&site_id={site_id}&geo={country}&revenue={revenue}&status={status}&click_id={click_id}&datetime={datetime}&sub1={sub_id_1}`
    : null;

  async function handleRegenerate() {
    setRegenerating(true);
    const result = await regeneratePostbackToken();
    setRegenerating(false);
    if (result.success && result.token) {
      setToken(result.token);
    }
  }

  async function handleCopy() {
    if (!postbackUrl) return;
    await navigator.clipboard.writeText(postbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <h4 className="mb-2 text-sm font-medium text-white">Telegram Lead Postback</h4>
      <p className="mb-3 text-xs text-slate-400">
        Configure this URL as a postback in Keitaro to receive realtime lead notifications in Telegram.
      </p>

      {postbackUrl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={postbackUrl}
              className="font-mono text-[11px] text-slate-300"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? "Copied!" : <><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={handleRegenerate} disabled={regenerating} className="text-xs text-slate-400 hover:text-white">
              {regenerating ? (
                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Regenerating...</>
              ) : (
                <><RefreshCw className="mr-1.5 h-3 w-3" />Regenerate Token</>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? "Generating..." : "Generate Postback URL"}
        </Button>
      )}
    </div>
  );
}

// ─── List Component ─────────────────────────────────────────────────────────

export function KeitaroConnectionsList({ instances, postbackToken }: KeitaroConnectionsListProps & { postbackToken: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      {instances.length === 0 && (
        <p className="text-sm text-slate-400">No Keitaro instances configured yet.</p>
      )}
      {instances.map((inst) => (
        <InstanceRow key={inst.id} instance={inst} />
      ))}
      <AddKeitaroForm />
      <PostbackUrlSection postbackToken={postbackToken} />
    </div>
  );
}
