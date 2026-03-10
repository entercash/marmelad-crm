import { Globe2 } from "lucide-react";

import { PageHeader }      from "@/components/shared/page-header";
import { EmptyState }      from "@/components/shared/empty-state";
import { Badge }           from "@/components/ui/badge";
import { PublisherSearch } from "./publisher-search";
import { getPublishers, type PublisherRow } from "@/features/publishers/queries";
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
  let publishers: PublisherRow[] = [];

  try {
    publishers = await getPublishers(searchParams.search);
  } catch (err) {
    console.error("[PublishersPage] Failed to fetch publishers:", err);
  }

  const hasSearch = !!searchParams.search;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Publishers"
        description="Analyze site performance and manage blacklist / whitelist decisions"
      />

      <PublisherSearch defaultSearch={searchParams.search} />

      {publishers.length === 0 ? (
        <EmptyState
          icon={Globe2}
          title={hasSearch ? "No publishers match your search" : "No publisher data yet"}
          description={hasSearch ? "Try a different name or domain." : "Publisher performance will appear here after Taboola sync is configured."}
        />
      ) : (
        <div className="dark-table-wrap">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {publishers.length} publisher{publishers.length !== 1 ? "s" : ""}
              {hasSearch ? " (filtered)" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 font-medium text-slate-400">Publisher</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Domain</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Source</th>
                  <th className="px-4 py-3 font-medium text-slate-400">List Status</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Quality</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {publishers.map((pub) => (
                  <tr key={pub.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="max-w-[240px] truncate px-4 py-3 font-medium text-white">{pub.name}</td>
                    <td className="px-4 py-3">
                      {pub.domain ? (
                        <span className="font-mono text-xs text-slate-400">{pub.domain}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{pub.trafficSource.name}</td>
                    <td className="px-4 py-3">
                      {pub.activeListEntry ? (
                        <Badge variant={listTypeVariant(pub.activeListEntry.listType)} title={pub.activeListEntry.listName}>
                          {listTypeLabel(pub.activeListEntry.listType)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {pub.qualityLabel ? (
                        <span className="capitalize">{pub.qualityLabel}</span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatRelativeTime(pub.updatedAt)}</td>
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
