export const dynamic = "force-dynamic";

import {
  Megaphone,
  Globe2,
  CreditCard,
  Tag,
  Receipt,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

import { PageHeader }         from "@/components/shared/page-header";
import { StatCard }           from "@/components/shared/stat-card";
import { Badge }              from "@/components/ui/badge";
import { getDashboardSummary } from "@/features/dashboard/queries";
import {
  syncStatusLabel,
  syncStatusVariant,
  formatRelativeTime,
} from "@/lib/format";

export const metadata = { title: "Dashboard" };

// Revalidate every 60 s so stat cards stay reasonably fresh without a full reload.
export const revalidate = 60;

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  const isEmpty =
    summary.campaigns.total === 0 &&
    summary.publishers === 0 &&
    summary.adAccounts === 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your media buying operations"
      />

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Campaigns */}
        <StatCard
          label="Campaigns"
          value={summary.campaigns.total}
          icon={Megaphone}
          iconClassName="text-indigo-400"
          description={
            summary.campaigns.total > 0
              ? `${summary.campaigns.active} active · ${summary.campaigns.paused} paused`
              : "No campaigns synced yet"
          }
        />

        {/* Publishers */}
        <StatCard
          label="Publishers"
          value={summary.publishers}
          icon={Globe2}
          iconClassName="text-teal-400"
          description={
            summary.publishers > 0
              ? "Tracked sites and placements"
              : "No publisher data yet"
          }
        />

        {/* Ad Accounts */}
        <StatCard
          label="Ad Accounts"
          value={summary.adAccounts}
          icon={CreditCard}
          iconClassName="text-blue-400"
          description={
            summary.adAccounts > 0
              ? "Linked billing accounts"
              : "No accounts configured"
          }
        />

        {/* Expense Categories */}
        <StatCard
          label="Expense Categories"
          value={summary.expenseCategories}
          icon={Tag}
          iconClassName="text-violet-400"
          description="Active cost categories"
        />

        {/* Expenses */}
        <StatCard
          label="Expenses"
          value={summary.expenses}
          icon={Receipt}
          iconClassName="text-amber-400"
          description={
            summary.expenses > 0
              ? "Manual cost entries logged"
              : "No expenses recorded yet"
          }
        />

        {/* Last Sync */}
        <StatCard
          label="Last Sync"
          value={
            summary.syncLogs.latest
              ? formatRelativeTime(summary.syncLogs.latest.startedAt)
              : "Never"
          }
          icon={RefreshCw}
          iconClassName="text-slate-400"
          description={
            summary.syncLogs.latest
              ? `${summary.syncLogs.latest.source} · ${summary.syncLogs.latest.entityType}`
              : "No sync jobs have run yet"
          }
          sub={
            summary.syncLogs.latest ? (
              <Badge
                variant={syncStatusVariant(summary.syncLogs.latest.status)}
                className="text-xs"
              >
                {syncStatusLabel(summary.syncLogs.latest.status)}
              </Badge>
            ) : undefined
          }
        />
      </div>

      {/* ── Getting started ─────────────────────────────────────────────────── */}
      {isEmpty && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">
            Getting started
          </h2>
          <p className="mb-5 text-sm text-slate-500">
            Marmelad CRM is ready — connect your data sources to start seeing
            live performance data.
          </p>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                1
              </span>
              <span>
                Open{" "}
                <Link
                  href="/settings"
                  className="font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  Settings
                </Link>{" "}
                and add your Taboola and Keitaro credentials.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                2
              </span>
              <span>
                Trigger a manual sync to import campaigns and publisher data.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                3
              </span>
              <span>
                Map spend campaigns to Keitaro conversions to enable P&amp;L
                reporting.
              </span>
            </li>
          </ol>
          <div className="mt-6 flex gap-3">
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              View campaigns <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/publishers"
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              View publishers <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Recent sync activity hint ─────────────────────────────────────── */}
      {!isEmpty && summary.syncLogs.last24hCount > 0 && (
        <p className="text-xs text-slate-400">
          {summary.syncLogs.last24hCount} sync job
          {summary.syncLogs.last24hCount !== 1 ? "s" : ""} ran in the last 24
          hours.
        </p>
      )}
    </div>
  );
}
