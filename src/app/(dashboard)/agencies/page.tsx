export const dynamic = "force-dynamic";

import { Building2, ExternalLink, Pencil, Plus } from "lucide-react";

import { PageHeader }         from "@/components/shared/page-header";
import { EmptyState }         from "@/components/shared/empty-state";
import { Button }             from "@/components/ui/button";
import { AgencyDialog }       from "@/features/agencies/components/agency-dialog";
import { DeleteAgencyButton } from "@/features/agencies/components/delete-agency-button";
import { getAgencies }        from "@/features/agencies/queries";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { formatRelativeTime }            from "@/lib/format";

export const metadata = { title: "Agencies" };

export default async function AgenciesPage() {
  const agencies = await getAgencies();

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

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
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

      {/* ── Agencies table ──────────────────────────────────────────────────── */}
      {agencies.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Row count */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {agencies.length} {agencies.length === 1 ? "agency" : "agencies"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Website</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Contact</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">
                    Account Cost
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">
                    Commission
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">
                    Crypto Fee %
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">Notes</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Updated</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {agencies.map((agency) => {
                  // Build the serializable edit-data object (no Date or count)
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
                    <tr
                      key={agency.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      {/* Name + linked-account count */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">
                          {agency.name}
                        </span>
                        {agency.adAccountCount > 0 && (
                          <span className="ml-2 text-xs text-slate-400">
                            {agency.adAccountCount}&nbsp;
                            {agency.adAccountCount === 1 ? "account" : "accounts"}
                          </span>
                        )}
                      </td>

                      {/* Website */}
                      <td className="px-4 py-3">
                        {agency.website ? (
                          <a
                            href={
                              agency.website.startsWith("http")
                                ? agency.website
                                : `https://${agency.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[180px] items-center gap-1 truncate text-blue-600 hover:text-blue-700 hover:underline"
                            title={agency.website}
                          >
                            <span className="truncate">
                              {agency.website.replace(/^https?:\/\//, "")}
                            </span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                        {agency.contact ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Account cost */}
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {agency.accountCostUsd !== null ? (
                          formatCurrency(agency.accountCostUsd)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Commission */}
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {agency.commissionPercent !== null ? (
                          formatPercent(agency.commissionPercent)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Crypto payment */}
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {agency.cryptoPaymentPercent !== null ? (
                          formatPercent(agency.cryptoPaymentPercent)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3">
                        {agency.notes ? (
                          <span
                            className="block max-w-[200px] truncate text-slate-600"
                            title={agency.notes}
                          >
                            {agency.notes}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-3 text-slate-400">
                        {formatRelativeTime(agency.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <AgencyDialog
                            agency={editData}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title={`Edit ${agency.name}`}
                                aria-label={`Edit ${agency.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />

                          {/* Delete */}
                          <DeleteAgencyButton
                            id={agency.id}
                            name={agency.name}
                            adAccountCount={agency.adAccountCount}
                          />
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
