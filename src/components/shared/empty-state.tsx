import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon:        LucideIcon;
  title:       string;
  description: string;
  /** Optional call-to-action rendered below the description. */
  action?:     React.ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
