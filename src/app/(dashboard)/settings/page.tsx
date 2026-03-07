import { PageHeader } from "@/components/shared/page-header";
import { Settings, Database, Zap, Key } from "lucide-react";

export const metadata = { title: "Settings" };

const sections = [
  {
    icon: Database,
    title: "Data Sources",
    description: "Connect Taboola and Keitaro to start syncing campaign and conversion data.",
    status: "Not configured",
    statusColor: "text-slate-400",
  },
  {
    icon: Zap,
    title: "Sync Schedule",
    description: "Configure how frequently data should be pulled from connected sources.",
    status: "Not configured",
    statusColor: "text-slate-400",
  },
  {
    icon: Key,
    title: "API Credentials",
    description: "Manage API keys and credentials for external integrations.",
    status: "Not configured",
    statusColor: "text-slate-400",
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Settings"
        description="Configure integrations, sync schedules, and system preferences"
      />

      <div className="grid gap-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100">
              <section.icon className="h-4 w-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                <span className={`text-xs ${section.statusColor}`}>
                  {section.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <Settings className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Full settings UI coming in Phase 2</p>
        <p className="mt-1 text-xs text-slate-400">
          For now, configure credentials via the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.env.local</code> file.
        </p>
      </div>
    </div>
  );
}
