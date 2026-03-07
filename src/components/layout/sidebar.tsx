"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Globe2,
  Receipt,
  Building2,
  CreditCard,
  Settings,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const navigation: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Performance",
    items: [
      { label: "Campaigns", href: "/campaigns", icon: Megaphone },
      { label: "Publishers", href: "/publishers", icon: Globe2 },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Expenses", href: "/expenses", icon: Receipt },
      { label: "Agencies", href: "/agencies", icon: Building2 },
      { label: "Ad Accounts", href: "/ad-accounts", icon: CreditCard },
    ],
  },
];

const bottomNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavLink({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-50"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  function isItemActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-slate-900 text-slate-50">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
          <Activity className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">
          Marmelad CRM
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-4">
          {navigation.map((group, i) => (
            <div key={i}>
              {group.label && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} isActive={isItemActive(item.href)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-800 px-2 py-3">
        <ul className="space-y-0.5">
          {bottomNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} isActive={isItemActive(item.href)} />
            </li>
          ))}
        </ul>

        {/* Version badge */}
        <p className="mt-3 px-3 text-[10px] text-slate-600">v0.1.0 · MVP</p>
      </div>
    </aside>
  );
}
