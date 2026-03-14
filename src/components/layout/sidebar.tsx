"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Megaphone,
  Globe2,
  Receipt,
  Building2,
  CreditCard,
  Wallet,
  FileCheck2,
  FileUp,
  Zap,
  Search,
  Settings,
  Activity,
  LogOut,
  Users,
  Wrench,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  /** If set, only users with this role see the link. */
  requiredRole?: string;
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
    label: "Integrations",
    items: [
      { label: "Taboola CSV", href: "/integrations/taboola-csv", icon: FileUp },
      { label: "Keitaro",     href: "/integrations/keitaro",     icon: Zap },
      { label: "SEO",         href: "/integrations/seo",         icon: Search },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "UTM Builder", href: "/tools/utm-builder", icon: Wrench },
      { label: "S2S Postback", href: "/tools/s2s-postback", icon: Send },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Expenses",     href: "/expenses",    icon: Receipt },
      { label: "Agencies",    href: "/agencies",    icon: Building2 },
      { label: "White Pages", href: "/white-pages", icon: FileCheck2 },
      { label: "Ad Accounts", href: "/ad-accounts", icon: CreditCard },
      { label: "Balances",    href: "/balances",    icon: Wallet },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Users", href: "/users", icon: Users, requiredRole: "ADMIN" },
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
          ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-50"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  function isItemActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  /** Filter nav items by requiredRole. */
  function filterItems(items: NavItem[]): NavItem[] {
    return items.filter(
      (item) => !item.requiredRole || item.requiredRole === userRole,
    );
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
          {navigation.map((group, i) => {
            const visibleItems = filterItems(group.items);
            if (visibleItems.length === 0) return null;
            return (
              <div key={i}>
                {group.label && (
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} isActive={isItemActive(item.href)} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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

        {/* User + Logout */}
        {session?.user && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between px-3">
              <span className="truncate text-xs text-slate-400">
                {session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out"
                className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Version badge */}
        <p className="mt-3 px-3 text-[10px] text-slate-600">v0.1.0 · MVP</p>
      </div>
    </aside>
  );
}
