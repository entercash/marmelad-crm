export const dynamic = "force-dynamic";

import { Plus, Upload, Globe2, ArrowUp, ArrowDown, Shield } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { DomainDialog } from "@/features/domains/components/domain-dialog";
import { BulkImportDialog } from "@/features/domains/components/bulk-import-dialog";
import { DomainFilters } from "@/features/domains/components/domain-filters";
import { getDomains, getDomainStats } from "@/features/domains/queries";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Domains" };

export default async function DomainsPage() {
  const [domains, stats] = await Promise.all([getDomains(), getDomainStats()]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Domain Monitor"
        description="Track domain availability, SSL certificates, and DNS health"
        action={
          <div className="flex items-center gap-2">
            <BulkImportDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Upload className="mr-1.5 h-4 w-4" />
                  Bulk Import
                </Button>
              }
            />
            <DomainDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Domain
                </Button>
              }
            />
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Globe2}
          label="Total Domains"
          value={stats.total}
        />
        <StatCard
          icon={ArrowUp}
          label="Up"
          value={stats.up}
          color="text-emerald-400"
        />
        <StatCard
          icon={ArrowDown}
          label="Down / Issues"
          value={stats.down}
          color={stats.down > 0 ? "text-red-400" : "text-slate-400"}
        />
        <StatCard
          icon={Shield}
          label="SSL Expiring"
          value={stats.sslExpiring}
          color={stats.sslExpiring > 0 ? "text-amber-400" : "text-slate-400"}
        />
      </div>

      {/* Filters + Grid */}
      <DomainFilters domains={domains} />
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[hsl(217,33%,13%)] px-5 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06]">
        <Icon className={`h-5 w-5 ${color ?? "text-slate-400"}`} />
      </div>
      <div>
        <p className={`text-2xl font-bold ${color ?? "text-white"}`}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
