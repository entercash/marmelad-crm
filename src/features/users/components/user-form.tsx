"use client";

/**
 * UserForm — create / edit form for a CRM user.
 *
 * Modes:
 *  - Create: `user` is undefined; submits createUser action.
 *  - Edit:   `user` provided; submits updateUser(id, ...) action.
 *            Password field is optional in edit mode.
 */

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { createUser, updateUser } from "@/features/users/actions";
import type { UserEditData }      from "@/features/users/queries";
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_ROLE_DESCRIPTIONS,
} from "@/features/users/schema";

// ─── Props ─────────────────────────────────────────────────────────────────

interface UserFormProps {
  user?:     UserEditData;
  onSuccess: () => void;
  onCancel:  () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const isEdit = !!user;

  const [error, setError]             = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

    const result = isEdit
      ? await updateUser(user.id, formData)
      : await createUser(formData);

    setSubmitting(false);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Global error */}
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="user-email">Email</Label>
        <Input
          id="user-email"
          name="email"
          type="email"
          placeholder="buyer@marmelad-crm.com"
          autoComplete="off"
          required
          defaultValue={user?.email ?? ""}
        />
        {fieldErrors.email && (
          <p className="text-xs text-red-500">{fieldErrors.email}</p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="user-name">Name <span className="text-slate-400">(optional)</span></Label>
        <Input
          id="user-name"
          name="name"
          type="text"
          placeholder="John Doe"
          autoComplete="off"
          defaultValue={user?.name ?? ""}
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="user-password">
          Password{isEdit && <span className="text-slate-400"> (leave blank to keep current)</span>}
        </Label>
        <Input
          id="user-password"
          name="password"
          type="password"
          placeholder={isEdit ? "••••••" : "Min 6 characters"}
          autoComplete="new-password"
          required={!isEdit}
        />
        {fieldErrors.password && (
          <p className="text-xs text-red-500">{fieldErrors.password}</p>
        )}
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <Label htmlFor="user-role">Role</Label>
        <select
          id="user-role"
          name="role"
          required
          defaultValue={user?.role ?? "BUYER"}
          className="flex h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40"
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]} — {USER_ROLE_DESCRIPTIONS[role]}
            </option>
          ))}
        </select>
        {fieldErrors.role && (
          <p className="text-xs text-red-500">{fieldErrors.role}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
        </Button>
      </div>
    </form>
  );
}
