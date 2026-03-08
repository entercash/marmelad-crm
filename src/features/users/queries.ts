/**
 * Users — data-access layer.
 *
 * Called from the Users Server Component. Never imported by client code.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────────────────

export type UserRow = {
  id:        string;
  email:     string;
  name:      string | null;
  role:      string;
  createdAt: string; // serialised for client
  updatedAt: string;
};

export type UserEditData = {
  id:    string;
  email: string;
  name:  string | null;
  role:  string;
};

// ─── Queries ───────────────────────────────────────────────────────────────

export async function getUsers(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:        true,
      email:     true,
      name:      true,
      role:      true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString().slice(0, 10),
    updatedAt: u.updatedAt.toISOString().slice(0, 10),
  }));
}
