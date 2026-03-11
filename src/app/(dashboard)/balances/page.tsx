export const dynamic = "force-dynamic";

import { Plus, Pencil, Wallet, ArrowUpCircle, ArrowDownCircle, AlertTriangle } from "lucide-react";

import { PageHeader }      from "@/components/shared/page-header";
import { TopUpDialog }     from "@/features/balances/components/top-up-dialog";
import { DeleteTopUpButton } from "@/features/balances/components/delete-top-up-button";
import { formatDate }      from "@/lib/format";
import {
  getTopUps,
  getAccountsForSelect,
  getBalanceSummaries,
} from "@/features/balances/queries";
import type { TopUpEditData } from "@/features/balances/queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUsd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(v);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BalancesPage() {
  const [topUps, accounts, summaries] = await Promise.all([
    getTopUps(),
    getAccountsForSelect(),
    getBalanceSummaries(),
  ]);

  // Only show accounts that have either top-ups or spend
  const activeSummaries = summaries.filter(
    (s) => s.totalTopUp > 0 || s.totalSpent > 0,
  );

  const totalDeposited = summaries.reduce((sum, s) => sum + s.totalTopUp, 0);
  const totalSpent     = summaries.reduce((sum, s) => sum + s.totalSpent, 0);
  const totalRemaining = totalDeposited - totalSpent;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Account Balances"
        description="Track deposits and remaining funds across ad accounts."
        action={
          <TopUpDialog
            accounts={accounts}
            trigger={
              <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500">
                <Plus className="h-4 w-4" />
                Add Top-Up
              </button>
            }
          />
        }
      />

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
            <ArrowUpCircle className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Deposited</p>
            <p className="text-lg font-bold text-white">{fmtUsd(totalDeposited)}</p>
          </div>
        </div>

        <div className="glass flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15">
            <ArrowDownCircle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Spent</p>
            <p className="text-lg font-bold text-white">{fmtUsd(totalSpent)}</p>
          </div>
        </div>

        <div className="glass flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
            <Wallet className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Remaining</p>
            <p className={`text-lg font-bold ${totalRemaining < 0 ? "text-red-400" : "text-white"}`}>
              {fmtUsd(totalRemaining)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Per-Account Balances ────────────────────────────────────────────── */}
      {activeSummaries.length > 0 && (
        <div className="dark-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-400">Account</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 text-right">Deposited</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 text-right">Spent</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {activeSummaries.map((s) => (
                <tr key={s.accountId} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">{s.accountName}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{fmtUsd(s.totalTopUp)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{fmtUsd(s.totalSpent)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 font-medium ${s.remaining < 0 ? "text-red-400" : s.remaining < 100 ? "text-amber-400" : "text-white"}`}>
                      {s.remaining < 100 && s.remaining >= 0 && (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {fmtUsd(s.remaining)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Top-Ups History ────────────────────────────────────────────────── */}
      {topUps.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15">
            <Wallet className="h-6 w-6 text-blue-400" />
          </div>
          <p className="text-sm font-medium text-slate-300">No top-ups yet</p>
          <p className="text-xs text-slate-500">Add your first account deposit to start tracking balances.</p>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-400">Top-Up History</h2>
          <div className="dark-table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">Account</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">Note</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {topUps.map((t) => {
                  const editData: TopUpEditData = {
                    id:        t.id,
                    accountId: t.accountId,
                    date:      t.date.toISOString().slice(0, 10),
                    amount:    String(t.amount),
                    note:      t.note,
                  };

                  return (
                    <tr key={t.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 font-medium text-white">{t.accountName}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-400">
                        +{fmtUsd(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {t.note ?? <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <TopUpDialog
                            topUp={editData}
                            accounts={accounts}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                                title="Edit top-up"
                                aria-label="Edit top-up"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
                          <DeleteTopUpButton id={t.id} />
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
