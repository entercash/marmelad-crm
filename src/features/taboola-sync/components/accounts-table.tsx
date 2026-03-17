import type { TaboolaAccountRow } from "../queries";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface AccountsTableProps {
  accounts: TaboolaAccountRow[];
}

export function AccountsTable({ accounts }: AccountsTableProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] py-12">
        <p className="text-sm font-medium text-slate-300">
          No Taboola accounts found
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Add accounts on the Ad Accounts page, then connect them in Settings
        </p>
      </div>
    );
  }

  return (
    <div className="dark-table-wrap">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Account ID</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-right">Campaigns</th>
            <th className="px-4 py-3 text-right">Active</th>
            <th className="px-4 py-3 text-right">Total Spend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {accounts.map((a) => (
            <tr
              key={a.id}
              className="transition-colors hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3 text-sm text-slate-200">
                {a.name}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs font-mono text-slate-400">
                {a.externalId ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    a.connected
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-500/20 text-slate-400"
                  }`}
                >
                  {a.connected ? "Connected" : "Not connected"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-300">
                {a.campaignCount.toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-emerald-400">
                {a.activeCampaignCount.toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-200">
                {formatCurrency(a.totalSpend)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
