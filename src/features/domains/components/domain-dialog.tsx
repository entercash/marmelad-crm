"use client";

/**
 * DomainDialog — wraps domain form in a Dialog.
 *
 * Usage:
 *   // Create mode
 *   <DomainDialog trigger={<Button>Add Domain</Button>} />
 *
 *   // Edit mode
 *   <DomainDialog domain={domainRow} trigger={<button>Edit</button>} />
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createDomain, updateDomain } from "@/features/domains/actions";
import type { DomainRow } from "@/features/domains/queries";

interface DomainDialogProps {
  domain?:  DomainRow;
  trigger:  React.ReactNode;
}

export function DomainDialog({ domain, trigger }: DomainDialogProps) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const router              = useRouter();

  const isEdit = !!domain;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateDomain(domain!.id, formData)
      : await createDomain(formData);

    setSaving(false);
    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
        {trigger}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Edit Domain" : "Add Domain"}
        description={
          isEdit
            ? `Editing "${domain!.name || domain!.url}"`
            : "Add a domain to monitor"
        }
        className="w-full max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain-url">URL</Label>
            <Input
              id="domain-url"
              name="url"
              defaultValue={domain?.url ?? ""}
              placeholder="https://example.com"
              className="font-mono"
              required
            />
            <p className="text-xs text-slate-500">
              Protocol will be added automatically if omitted.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain-name">Label (optional)</Label>
            <Input
              id="domain-name"
              name="name"
              defaultValue={domain?.name ?? ""}
              placeholder="My Landing Page"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain-notes">Notes (optional)</Label>
            <textarea
              id="domain-notes"
              name="notes"
              defaultValue={domain?.notes ?? ""}
              placeholder="Offer #123, used for GEO US"
              rows={3}
              className="w-full rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEdit ? "Save" : "Add Domain"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
