"use client";

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSeoBrand } from "../actions";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function SeoBrandForm({ onSuccess, onCancel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function fe(field: string) {
    return fieldErrors[field];
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await createSeoBrand(formData);

    setPending(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
      if ("fieldErrors" in result && result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Brand Name *</Label>
        <Input name="name" required placeholder="e.g. BrandX Finance" />
        {fe("name") && <p className="text-xs text-red-400">{fe("name")}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Link *</Label>
        <Input name="link" required placeholder="https://example.com" />
        {fe("link") && <p className="text-xs text-red-400">{fe("link")}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating..." : "Add Brand"}
        </Button>
      </div>
    </form>
  );
}
