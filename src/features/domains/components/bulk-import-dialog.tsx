"use client";

/**
 * BulkImportDialog — paste multiple domains (one per line) to add them all at once.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { bulkImportDomains } from "@/features/domains/actions";
import type { BulkImportResult } from "@/features/domains/actions";

interface BulkImportDialogProps {
  trigger: React.ReactNode;
}

export function BulkImportDialog({ trigger }: BulkImportDialogProps) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [result, setResult]   = useState<BulkImportResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const router                = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const text = (formData.get("urls") as string) ?? "";
    const urls = text.split("\n").map((l) => l.trim()).filter(Boolean);

    if (urls.length === 0) {
      setError("Paste at least one domain");
      setSaving(false);
      return;
    }

    const res = await bulkImportDomains(urls);
    setSaving(false);

    if ("added" in res) {
      setResult(res);
      router.refresh();
    } else if (!res.success) {
      setError(res.error);
    }
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
    setError(null);
  }

  return (
    <>
      <div onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
        {trigger}
      </div>

      <Dialog
        open={open}
        onClose={handleClose}
        title="Bulk Import Domains"
        description="Paste domains, one per line. Duplicates will be skipped."
        className="w-full max-w-lg"
      >
        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-slate-800 p-4 text-sm">
              <p className="text-emerald-400 font-medium">
                ✓ Added: {result.added}
              </p>
              {result.skipped > 0 && (
                <p className="text-slate-400 mt-1">
                  Skipped (duplicates): {result.skipped}
                </p>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-400">Errors:</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-red-400/80">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-urls">Domains</Label>
              <textarea
                id="bulk-urls"
                name="urls"
                rows={10}
                placeholder={"example.com\nhttps://landing.io\nmy-offer.shop"}
                className="w-full rounded-md border border-white/10 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              />
              <p className="text-xs text-slate-500">
                One domain per line. Protocol will be added automatically.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
