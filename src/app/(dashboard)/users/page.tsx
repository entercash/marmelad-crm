export const dynamic = "force-dynamic";

import { Pencil, Plus, Shield, ShieldCheck, BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
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
  const session = await requireAdmin(); // redirects non-admins to /
  const currentUserId = session.user.id;

  let users;
  try {
    users = await getUsers();
  } catch (err) {
    console.error("[UsersPage]", err);
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Users" description="Manage CRM user accounts" />
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            Unable to load users. Please check the database connection.
          </p>
        </div>
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
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            No users found
          </p>
          <p className="text-sm text-slate-500">
            Create the first user to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-3 font-medium text-slate-500">Email</th>
                <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500">Role</th>
                <th className="px-4 py-3 font-medium text-slate-500">Created</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50"
                  >
                    {/* Email */}
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-slate-400">(you)</span>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 text-slate-600">
                      {u.name || "—"}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(u.createdAt)}
                    </td>

                    {/* Actions */}
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
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
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
