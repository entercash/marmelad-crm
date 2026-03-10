export const dynamic = "force-dynamic";

import { Building2, ExternalLink, Pencil, Plus } from "lucide-react";

import { PageHeader }         from "@/components/shared/page-header";
import { EmptyState }         from "@/components/shared/empty-state";
import { Button }             from "@/components/ui/button";
import { AgencyDialog }       from "@/features/agencies/components/agency-dialog";
import { DeleteAgencyButton } from "@/features/agencies/components/delete-agency-button";
import { getAgencies, type AgencyRow } from "@/features/agencies/queries";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { formatRelativeTime }            from "@/lib/format";

export const metadata = { title: "Agencies" };

export default async function AgenciesPage() {
  let agencies: AgencyRow[] = [];

  try {
    agencies = await getAgencies();
  } catch (err) {
    console.error("[AgenciesPage] Failed to fetch agencies:", err);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Agencies"
        description="Manage agency relationships, financial terms, and account assignments"
        action={
          <AgencyDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                New Agency
              </Button>
            }
          />
        }
      />

      {agencies.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No agencies yet"
          description="Add agencies to track financial terms, commissions, and account assignments."
          action={
            <AgencyDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add First Agency
                </Button>
              }
            />
          }
        />
      )}

      {agencies.length > 0 && (
        <div className="dark-table-wrap">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {agencies.length} {agencies.length === 1 ? "agency" : "agencies"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Website</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Contact</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">Account Cost</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">Commission</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">Crypto Fee %</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Notes</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Updated</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {agencies.map((agency) => {
                  const editData = {
                    id:                  agency.id,
                    name:                agency.name,
                    website:             agency.website,
                    contact:             agency.contact,
                    accountCostUsd:      agency.accountCostUsd,
                    commissionPercent:   agency.commissionPercent,
                    cryptoPaymentPercent: agency.cryptoPaymentPercent,
                    notes:               agency.notes,
                  };

                  return (
                    <tr key={agency.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{agency.name}</span>
                        {agency.adAccountCount > 0 && (
                          <span className="ml-2 text-xs text-slate-500">
                            {agency.adAccountCount}&nbsp;{agency.adAccountCount === 1 ? "account" : "accounts"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {agency.website ? (
                          <a
                            href={agency.website.startsWith("http") ? agency.website : `https://${agency.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[180px] items-center gap-1 truncate text-blue-400 hover:text-blue-300 hover:underline"
                            title={agency.website}
                          >
                            <span className="truncate">{agency.website.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-slate-300">
                        {agency.contact ?? <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {agency.accountCostUsd !== null ? formatCurrency(agency.accountCostUsd) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {agency.commissionPercent !== null ? formatPercent(agency.commissionPercent) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {agency.cryptoPaymentPercent !== null ? formatPercent(agency.cryptoPaymentPercent) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {agency.notes ? (
                          <span className="block max-w-[200px] truncate text-slate-400" title={agency.notes}>{agency.notes}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatRelativeTime(agency.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <AgencyDialog
                            agency={editData}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                                title={`Edit ${agency.name}`}
                                aria-label={`Edit ${agency.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
                          <DeleteAgencyButton id={agency.id} name={agency.name} adAccountCount={agency.adAccountCount} />
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
