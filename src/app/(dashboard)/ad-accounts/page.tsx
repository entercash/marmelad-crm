export const dynamic = "force-dynamic";

import {
  CreditCard,
  Plus,
  CheckCircle2,
  Clock,
  ShieldAlert,
  LayoutGrid,
} from "lucide-react";

import { PageHeader }    from "@/components/shared/page-header";
import { EmptyState }    from "@/components/shared/empty-state";
import { StatCard }      from "@/components/shared/stat-card";
import { Button }        from "@/components/ui/button";
import { AccountDialog } from "@/features/ad-accounts/components/account-dialog";
import { AccountFilters } from "@/features/ad-accounts/components/account-filters";
import {
  getAccounts,
  getAgenciesForSelect,
  getAccountStats,
  type AccountRow,
  type AgencyOption,
  type AccountStats,
} from "@/features/ad-accounts/queries";

export const metadata = { title: "Ad Accounts" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdAccountsPage() {
  let accounts: AccountRow[]   = [];
  let agencies: AgencyOption[] = [];
  let stats: AccountStats      = { total: 0, active: 0, underModeration: 0, banned: 0, empty: 0 };

  try {
    [accounts, agencies, stats] = await Promise.all([
      getAccounts(),
      getAgenciesForSelect(),
      getAccountStats(),
    ]);
  } catch (err) {
    console.error("[AdAccountsPage] Failed to fetch data:", err);
  }

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

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Accounts"
          value={stats.total}
          icon={LayoutGrid}
          iconClassName="text-slate-400"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={CheckCircle2}
          iconClassName="text-emerald-500"
        />
        <StatCard
          label="Under Moderation"
          value={stats.underModeration}
          icon={Clock}
          iconClassName="text-amber-500"
        />
        <StatCard
          label="Banned"
          value={stats.banned}
          icon={ShieldAlert}
          iconClassName="text-red-500"
        />
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {accounts.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="No accounts yet"
          description="Add advertising accounts to track their status and agency assignments."
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

      {/* ── Filters + Card grid ──────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <AccountFilters accounts={accounts} agencies={agencies} />
      )}
    </div>
  );
}
