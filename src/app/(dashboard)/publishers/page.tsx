import { Globe2 } from "lucide-react";

import { PageHeader }      from "@/components/shared/page-header";
import { EmptyState }      from "@/components/shared/empty-state";
import { Badge }           from "@/components/ui/badge";
import { PublisherSearch } from "./publisher-search";
import { getPublishers }   from "@/features/publishers/queries";
import {
  listTypeLabel,
  listTypeVariant,
  formatRelativeTime,
} from "@/lib/format";

export const metadata = { title: "Publishers" };

type SearchParams = { search?: string };

export default async function PublishersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const publishers = await getPublishers(searchParams.search);
  const hasSearch  = !!searchParams.search;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Publishers"
        description="Analyze site performance and manage blacklist / whitelist decisions"
      />

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <PublisherSearch defaultSearch={searchParams.search} />

      {/* ── Table or empty state ─────────────────────────────────────────────── */}
      {publishers.length === 0 ? (
        <EmptyState
          icon={Globe2}
          title={
            hasSearch
              ? "No publishers match your search"
              : "No publisher data yet"
          }
          description={
            hasSearch
              ? "Try a different name or domain."
              : "Publisher performance will appear here after Taboola sync is configured."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Row count */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {publishers.length} publisher{publishers.length !== 1 ? "s" : ""}
              {hasSearch ? " (filtered)" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Publisher
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Domain
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Source
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    List Status
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Quality
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {publishers.map((pub) => (
                  <tr
                    key={pub.id}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    {/* Publisher name */}
                    <td className="max-w-[240px] truncate px-4 py-3 font-medium text-slate-900">
                      {pub.name}
                    </td>

                    {/* Domain */}
                    <td className="px-4 py-3">
                      {pub.domain ? (
                        <span className="font-mono text-xs text-slate-600">
                          {pub.domain}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Traffic source */}
                    <td className="px-4 py-3 text-slate-500">
                      {pub.trafficSource.name}
                    </td>

                    {/* List status */}
                    <td className="px-4 py-3">
                      {pub.activeListEntry ? (
                        <Badge
                          variant={listTypeVariant(
                            pub.activeListEntry.listType,
                          )}
                          title={pub.activeListEntry.listName}
                        >
                          {listTypeLabel(pub.activeListEntry.listType)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-300">None</span>
                      )}
                    </td>

                    {/* Quality label */}
                    <td className="px-4 py-3 text-slate-500">
                      {pub.qualityLabel ? (
                        <span className="capitalize">{pub.qualityLabel}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 text-slate-400">
                      {formatRelativeTime(pub.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
