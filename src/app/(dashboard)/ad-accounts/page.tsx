export const dynamic = "force-dynamic";

import { CreditCard, Pencil, Plus } from "lucide-react";

import { PageHeader }                        from "@/components/shared/page-header";
import { EmptyState }                        from "@/components/shared/empty-state";
import { Button }                            from "@/components/ui/button";
import { AccountDialog }                     from "@/features/ad-accounts/components/account-dialog";
import { DeleteAccountButton }               from "@/features/ad-accounts/components/delete-account-button";
import { getAccounts, getAgenciesForSelect } from "@/features/ad-accounts/queries";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_PLATFORM_LABELS,
  ACCOUNT_TYPE_LABELS,
} from "@/features/ad-accounts/schema";

export const metadata = { title: "Ad Accounts" };

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  EMPTY:            "bg-slate-100 text-slate-500",
  UNDER_MODERATION: "bg-amber-100 text-amber-700",
  ACTIVE:           "bg-green-100 text-green-700",
  BANNED:           "bg-red-100 text-red-600",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_CLASSES[status] ?? "bg-slate-100 text-slate-500"
      }`}
    >
      {ACCOUNT_STATUS_LABELS[status as keyof typeof ACCOUNT_STATUS_LABELS] ?? status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdAccountsPage() {
  const [accounts, agencies] = await Promise.all([
    getAccounts(),
    getAgenciesForSelect(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Ad Accounts"
        description="Manage advertising accounts and their agency relationships"
        action={
          <AccountDialog
            agencies={agencies}
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                New Account
              </Button>
            }
          />
        }
      />

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {accounts.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="No accounts yet"
          description="Add advertising accounts to track their status, credentials, and agency assignments."
          action={
            <AccountDialog
              agencies={agencies}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add First Account
                </Button>
              }
            />
          }
        />
      )}

      {/* ── Accounts table ──────────────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Row count */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">ID</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Email</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Password</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Agency</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Platform</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Account Type</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Account Country</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Traffic Country</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {accounts.map((account) => {
                  const editData = {
                    id:             account.id,
                    name:           account.name,
                    email:          account.email,
                    password:       account.password,
                    agencyId:       account.agencyId,
                    platform:       account.platform,
                    accountType:    account.accountType,
                    status:         account.status,
                    accountCountry: account.accountCountry,
                    trafficCountry: account.trafficCountry,
                  };

                  return (
                    <tr
                      key={account.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      {/* ID */}
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-xs text-slate-400"
                          title={account.id}
                        >
                          {account.id.slice(0, 8)}…
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{account.name}</span>
                      </td>

                      {/* Email */}
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                        {account.email}
                      </td>

                      {/* Password */}
                      <td className="max-w-[140px] truncate px-4 py-3 font-mono text-slate-500">
                        {account.password}
                      </td>

                      {/* Agency — resolved from relation */}
                      <td className="px-4 py-3 text-slate-600">
                        {account.agencyName ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Platform */}
                      <td className="px-4 py-3 text-slate-600">
                        {ACCOUNT_PLATFORM_LABELS[account.platform as keyof typeof ACCOUNT_PLATFORM_LABELS] ?? account.platform}
                      </td>

                      {/* Account Type */}
                      <td className="px-4 py-3 text-slate-600">
                        {ACCOUNT_TYPE_LABELS[account.accountType as keyof typeof ACCOUNT_TYPE_LABELS] ?? account.accountType}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={account.status} />
                      </td>

                      {/* Account Country */}
                      <td className="px-4 py-3 text-slate-600">
                        {account.accountCountry ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Traffic Country */}
                      <td className="px-4 py-3 text-slate-600">
                        {account.trafficCountry ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <AccountDialog
                            account={editData}
                            agencies={agencies}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title={`Edit ${account.name}`}
                                aria-label={`Edit ${account.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />

                          <DeleteAccountButton id={account.id} name={account.name} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
