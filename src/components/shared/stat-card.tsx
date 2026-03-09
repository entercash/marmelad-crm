import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label:          string;
  value:          string | number;
  description?:   string;
  icon:           LucideIcon;
  iconClassName?: string;
  /** Optional content rendered below the value — e.g. a status Badge. */
  sub?:           React.ReactNode;
};

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName = "text-slate-400",
  sub,
}: StatCardProps) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <Icon className={`h-4 w-4 ${iconClassName}`} />
      </div>

      <div className="mt-2">
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>

      {sub && <div className="mt-1">{sub}</div>}

      {description && (
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
}
