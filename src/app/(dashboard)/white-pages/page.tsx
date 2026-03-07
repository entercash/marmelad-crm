export const dynamic = "force-dynamic";

import { FileCheck2, ExternalLink, Pencil, Plus } from "lucide-react";

import { PageHeader }            from "@/components/shared/page-header";
import { EmptyState }            from "@/components/shared/empty-state";
import { Button }                from "@/components/ui/button";
import { WhitePageDialog }       from "@/features/white-pages/components/white-page-dialog";
import { DeleteWhitePageButton } from "@/features/white-pages/components/delete-white-page-button";
import { getWhitePages }         from "@/features/white-pages/queries";
import {
  WHITE_PAGE_STATUS_LABELS,
  WHITE_PAGE_STATUS_BADGE_CLASS,
} from "@/features/white-pages/schema";
import { formatDate } from "@/lib/format";

export const metadata = { title: "White Pages" };

export default async function WhitePagesPage() {
  const whitePages = await getWhitePages();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="White Pages"
        description="Manage white pages — track transfer dates, credentials, legal data, and lifecycle status"
        action={
          <WhitePageDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add White Page
              </Button>
            }
          />
        }
      />

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {whitePages.length === 0 && (
        <EmptyState
          icon={FileCheck2}
          title="No white pages yet"
          description="Add white pages to track landing pages used for ad network moderation."
          action={
            <WhitePageDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add First White Page
                </Button>
              }
            />
          }
        />
      )}

      {/* ── White Pages table ────────────────────────────────────────────────── */}
      {whitePages.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Row count */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {whitePages.length}{" "}
              {whitePages.length === 1 ? "white page" : "white pages"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-500">GEO</th>
                  <th className="px-4 py-3 font-medium text-slate-500">URL</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Topic</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Zoho Email</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Password</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Legal Entity</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Tax #</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {whitePages.map((wp) => {
                  // Build the serialisable edit-data object (no Date objects).
                  // transferDate is converted to "YYYY-MM-DD" for the date input.
                  const editData = {
                    id:              wp.id,
                    transferDate:    wp.transferDate.toISOString().slice(0, 10),
                    geo:             wp.geo,
                    url:             wp.url,
                    topic:           wp.topic,
                    zohoEmail:       wp.zohoEmail,
                    password:        wp.password,
                    legalEntityData: wp.legalEntityData,
                    taxNumber:       wp.taxNumber,
                    status:          wp.status,
                  };

                  return (
                    <tr
                      key={wp.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      {/* Transfer date */}
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(wp.transferDate)}
                      </td>

                      {/* GEO */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {wp.geo}
                        </span>
                      </td>

                      {/* URL — clickable, strips protocol for display */}
                      <td className="px-4 py-3">
                        <a
                          href={
                            wp.url.startsWith("http")
                              ? wp.url
                              : `https://${wp.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-[160px] items-center gap-1 truncate text-blue-600 hover:text-blue-700 hover:underline"
                          title={wp.url}
                        >
                          <span className="truncate">
                            {wp.url.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>

                      {/* Topic */}
                      <td className="px-4 py-3">
                        {wp.topic ? (
                          <span
                            className="block max-w-[120px] truncate text-slate-600"
                            title={wp.topic}
                          >
                            {wp.topic}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Zoho email */}
                      <td className="px-4 py-3">
                        {wp.zohoEmail ? (
                          <span
                            className="block max-w-[150px] truncate text-slate-600"
                            title={wp.zohoEmail}
                          >
                            {wp.zohoEmail}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Password — shown as plain text (internal tool) */}
                      <td className="px-4 py-3">
                        {wp.password ? (
                          <span className="font-mono text-xs text-slate-600">
                            {wp.password}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Legal entity data */}
                      <td className="px-4 py-3">
                        {wp.legalEntityData ? (
                          <span
                            className="block max-w-[150px] truncate text-slate-600"
                            title={wp.legalEntityData}
                          >
                            {wp.legalEntityData}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Tax number */}
                      <td className="px-4 py-3">
                        {wp.taxNumber ? (
                          <span className="font-mono text-xs text-slate-600">
                            {wp.taxNumber}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${WHITE_PAGE_STATUS_BADGE_CLASS[wp.status]}`}
                        >
                          {WHITE_PAGE_STATUS_LABELS[wp.status]}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <WhitePageDialog
                            whitePage={editData}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title="Edit white page"
                                aria-label="Edit white page"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />

                          {/* Delete */}
                          <DeleteWhitePageButton id={wp.id} />
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
