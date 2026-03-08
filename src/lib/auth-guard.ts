/**
 * Server-side role-checking utilities.
 *
 * Used in server actions and server components to enforce access control.
 * Relies on the NextAuth session (JWT) — no extra DB queries needed.
 */

import { getServerSession } from "next-auth";
import { redirect }         from "next/navigation";
import { authOptions }      from "@/lib/auth";

// ─── Role hierarchy ─────────────────────────────────────────────────────────

/** Roles that can perform write operations (create/update/delete). */
const WRITE_ROLES = new Set(["ADMIN", "BUYER"]);

/** Roles that can access the admin area (user management, settings). */
const ADMIN_ROLES = new Set(["ADMIN"]);

// ─── Server-side session helpers ─────────────────────────────────────────────

/**
 * Get the current session. Returns null if not authenticated.
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 * Returns the session (guaranteed non-null).
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Require ADMIN role. Redirects to / if not admin.
 * Returns the session (guaranteed non-null, role=ADMIN).
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (!ADMIN_ROLES.has(session.user.role)) redirect("/");
  return session;
}

// ─── Server-action guards ────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: true; id: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Checks the session and returns a rejection result if the user
 * does not have write access (ADMIN or BUYER).
 * Returns null if access is granted (proceed with the action).
 */
export async function guardWrite(): Promise<ActionResult | null> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  if (!WRITE_ROLES.has(session.user.role)) {
    return { success: false, error: "You do not have permission to perform this action" };
  }
  return null; // access granted
}

/**
 * Checks the session and returns a rejection result if the user
 * is not an ADMIN.
 * Returns null if access is granted (proceed with the action).
 */
export async function guardAdmin(): Promise<ActionResult | null> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  if (!ADMIN_ROLES.has(session.user.role)) {
    return { success: false, error: "Admin access required" };
  }
  return null; // access granted
}
