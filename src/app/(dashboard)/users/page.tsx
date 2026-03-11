export const dynamic = "force-dynamic";

import { Pencil, Plus, Shield, ShieldCheck, BarChart3, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button }     from "@/components/ui/button";
import { Badge }      from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth-guard";
import { getUsers }     from "@/features/users/queries";
import { UserDialog }        from "@/features/users/components/user-dialog";
import { DeleteUserButton }  from "@/features/users/components/delete-user-button";
import { formatDate }        from "@/lib/format";

export const metadata = { title: "Users" };

// ─── Role display helpers ─────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, {
  label:   string;
  variant: "default" | "secondary" | "outline";
  icon:    React.ElementType;
}> = {
  ADMIN:   { label: "Admin",   variant: "default",   icon: ShieldCheck },
  BUYER:   { label: "Buyer",   variant: "secondary", icon: Shield },
  ANALYST: { label: "Analyst", variant: "outline",   icon: BarChart3 },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] ?? { label: role, variant: "outline" as const, icon: Shield };
  const Icon   = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function UsersPage() {
  const session = await requireAdmin();
  const currentUserId = session.user.id;

  let users;
  try {
    users = await getUsers();
  } catch (err) {
    console.error("[UsersPage]", err);
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Users" description="Manage CRM user accounts" />
        <EmptyState
          icon={Users}
          title="Unable to load users"
          description="Please check the database connection."
        />
      </div>
    );
  }

  const isEmpty = users.length === 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Users"
        description="Manage CRM user accounts and roles"
        action={
          <UserDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                New User
              </Button>
            }
          />
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Create the first user to get started."
          action={
            <UserDialog
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New User
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="dark-table-wrap">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 font-medium text-slate-400">Email</th>
                <th className="px-4 py-3 font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 font-medium text-slate-400">Role</th>
                <th className="px-4 py-3 font-medium text-slate-400">Created</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-slate-500">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {u.name || <span className="text-slate-600">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <UserDialog
                          user={{
                            id:    u.id,
                            email: u.email,
                            name:  u.name,
                            role:  u.role,
                          }}
                          trigger={
                            <button
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                              title="Edit user"
                              aria-label="Edit user"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          }
                        />
                        <DeleteUserButton id={u.id} isSelf={isSelf} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
