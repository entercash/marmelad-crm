export const dynamic = "force-dynamic";

import { FileCheck2, ExternalLink, Pencil, Plus } from "lucide-react";

import { PageHeader }            from "@/components/shared/page-header";
import { EmptyState }            from "@/components/shared/empty-state";
import { Button }                from "@/components/ui/button";
import { WhitePageDialog }       from "@/features/white-pages/components/white-page-dialog";
import { DeleteWhitePageButton } from "@/features/white-pages/components/delete-white-page-button";
import { getWhitePages, type WhitePageRow } from "@/features/white-pages/queries";
import {
  WHITE_PAGE_STATUS_LABELS,
  type WhitePageStatusValue,
} from "@/features/white-pages/schema";
import { formatDate } from "@/lib/format";

export const metadata = { title: "White Pages" };

// ─── Dark-themed status badge styles ────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  PREMODERATION:        { dot: "bg-slate-400",    bg: "bg-slate-500/15",   text: "text-slate-400" },
  ACCOUNT_ISSUED:       { dot: "bg-blue-400",     bg: "bg-blue-500/15",    text: "text-blue-400" },
  WARMUP_STARTED:       { dot: "bg-amber-400",    bg: "bg-amber-500/15",   text: "text-amber-400" },
  IN_PROGRESS:          { dot: "bg-emerald-400",  bg: "bg-emerald-500/15", text: "text-emerald-400" },
  PREMODERATION_FAILED: { dot: "bg-red-400",      bg: "bg-red-500/15",     text: "text-red-400" },
  ACCOUNT_BANNED:       { dot: "bg-red-400",      bg: "bg-red-500/15",     text: "text-red-400" },
};

export default async function WhitePagesPage() {
  let whitePages: WhitePageRow[] = [];
  try {
    whitePages = await getWhitePages();
  } catch (err) {
    console.error("[WhitePagesPage] Failed to fetch white pages:", err);
  }

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
        <div className="dark-table-wrap">
          {/* Row count */}
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {whitePages.length}{" "}
              {whitePages.length === 1 ? "white page" : "white pages"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 font-medium text-slate-400">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-400">GEO</th>
                  <th className="px-4 py-3 font-medium text-slate-400">URL</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Topic</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Zoho Email</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Password</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Legal Entity</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Tax #</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {whitePages.map((wp) => {
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

                  const statusStyle = STATUS_STYLES[wp.status] ?? STATUS_STYLES.PREMODERATION;

                  return (
                    <tr
                      key={wp.id}
                      className="transition-colors hover:bg-white/[0.03]"
                    >
                      {/* Transfer date */}
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                        {formatDate(wp.transferDate)}
                      </td>

                      {/* GEO */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-white">
                          {wp.geo}
                        </span>
                      </td>

                      {/* URL */}
                      <td className="px-4 py-3">
                        <a
                          href={
                            wp.url.startsWith("http")
                              ? wp.url
                              : `https://${wp.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-[160px] items-center gap-1 truncate text-blue-400 hover:text-blue-300 hover:underline"
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
                            className="block max-w-[120px] truncate text-slate-300"
                            title={wp.topic}
                          >
                            {wp.topic}
                          </span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>

                      {/* Zoho email */}
                      <td className="px-4 py-3">
                        {wp.zohoEmail ? (
                          <span
                            className="block max-w-[150px] truncate text-slate-300"
                            title={wp.zohoEmail}
                          >
                            {wp.zohoEmail}
                          </span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>

                      {/* Password */}
                      <td className="px-4 py-3">
                        {wp.password ? (
                          <span className="font-mono text-xs text-slate-300">
                            {wp.password}
                          </span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>

                      {/* Legal entity data */}
                      <td className="px-4 py-3">
                        {wp.legalEntityData ? (
                          <span
                            className="block max-w-[150px] truncate text-slate-300"
                            title={wp.legalEntityData}
                          >
                            {wp.legalEntityData}
                          </span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>

                      {/* Tax number */}
                      <td className="px-4 py-3">
                        {wp.taxNumber ? (
                          <span className="font-mono text-xs text-slate-300">
                            {wp.taxNumber}
                          </span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                          {WHITE_PAGE_STATUS_LABELS[wp.status as WhitePageStatusValue]}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <WhitePageDialog
                            whitePage={editData}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                                title="Edit white page"
                                aria-label="Edit white page"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
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
