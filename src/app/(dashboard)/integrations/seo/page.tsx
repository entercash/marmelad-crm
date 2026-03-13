export const dynamic = "force-dynamic";

import { Search, Plus, ExternalLink } from "lucide-react";

import { PageHeader }  from "@/components/shared/page-header";
import { EmptyState }  from "@/components/shared/empty-state";
import { Button }      from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { formatDate }     from "@/lib/format";

import { getSeoBrands, getSeoLeads } from "@/features/seo/queries";
import { SeoBrandDialog }   from "@/features/seo/components/seo-brand-dialog";
import { SeoLeadDialog }    from "@/features/seo/components/seo-lead-dialog";
import { DeleteBrandButton } from "@/features/seo/components/delete-brand-button";
import { DeleteLeadButton }  from "@/features/seo/components/delete-lead-button";

export const metadata = { title: "SEO Brands & Leads" };

export default async function SeoPage() {
  const brands = await getSeoBrands();

  const brandsWithLeads = await Promise.all(
    brands.map(async (brand) => ({
      ...brand,
      leads: await getSeoLeads(brand.id),
    })),
  );

  const totalLeads = brands.reduce((s, b) => s + b.totalLeads, 0);
  const totalRevenue = brands.reduce((s, b) => s + b.totalRevenue, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="SEO Brands & Leads"
        description="Track SEO brands and manually log lead entries"
        action={
          <SeoBrandDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Brand
              </Button>
            }
          />
        }
      />

      {/* Summary cards */}
      {brands.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Brands</p>
            <p className="mt-1 text-2xl font-semibold text-white">{brands.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Leads</p>
            <p className="mt-1 text-2xl font-semibold text-white">{totalLeads.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Revenue</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {brands.length === 0 && (
        <EmptyState
          icon={Search}
          title="No SEO brands yet"
          description="Add an SEO brand to start tracking leads and revenue."
          action={
            <SeoBrandDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Brand
                </Button>
              }
            />
          }
        />
      )}

      {/* Brand cards */}
      {brandsWithLeads.map((brand) => (
        <div
          key={brand.id}
          className="rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl"
        >
          {/* Brand header */}
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white truncate">{brand.name}</h3>
                <a
                  href={brand.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-blue-400 transition-colors"
                  title={brand.link}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {brand.totalLeads} leads &middot; {formatCurrency(brand.totalRevenue)} revenue
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SeoLeadDialog
                brandId={brand.id}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Leads
                  </Button>
                }
              />
              <DeleteBrandButton id={brand.id} />
            </div>
          </div>

          {/* Leads table */}
          {brand.leads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Country</th>
                    <th className="px-5 py-3">Model</th>
                    <th className="px-5 py-3 text-right">Leads</th>
                    <th className="px-5 py-3 text-right">Rate</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                    <th className="px-5 py-3 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {brand.leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-white/[0.04] text-slate-300 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-5 py-2.5">{formatDate(lead.date)}</td>
                      <td className="px-5 py-2.5">{lead.country}</td>
                      <td className="px-5 py-2.5">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium">
                          {lead.paymentModel}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{lead.quantity}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatCurrency(lead.rate)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-emerald-400">
                        {formatCurrency(lead.revenue)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <DeleteLeadButton id={lead.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-xs text-slate-500">
              No leads yet. Click &quot;Add Leads&quot; to start.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
