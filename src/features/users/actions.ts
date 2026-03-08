"use server";

/**
 * Users — server actions (create, update, delete).
 *
 * All actions require ADMIN role.
 * Passwords are hashed with bcryptjs (12 rounds).
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";
import { hash }           from "bcryptjs";

import { prisma }       from "@/lib/prisma";
import { guardAdmin, getSession } from "@/lib/auth-guard";
import type { ActionResult }      from "@/lib/auth-guard";
import { createUserSchema, updateUserSchema } from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFieldErrors(
  issues: { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ─── Create user ─────────────────────────────────────────────────────────────

export async function createUser(formData: FormData): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const raw    = Object.fromEntries(formData.entries());
  const parsed = createUserSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success:     false,
      error:       parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const { email, password, name, role } = parsed.data;

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      success:     false,
      error:       "A user with this email already exists",
      fieldErrors: { email: "This email is already taken" },
    };
  }

  try {
    const passwordHash = await hash(password, 12);
    await prisma.user.create({
      data: { email, passwordHash, name, role },
    });
    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    console.error("[createUser]", err);
    return { success: false, error: "Failed to create user. Please try again." };
  }
}

// ─── Update user ─────────────────────────────────────────────────────────────

export async function updateUser(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const raw    = Object.fromEntries(formData.entries());
  const parsed = updateUserSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success:     false,
      error:       parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const { email, password, name, role } = parsed.data;

  // Prevent an admin from demoting themselves (would lock everyone out)
  const session = await getSession();
  if (session?.user.id === id && role !== "ADMIN") {
    return {
      success: false,
      error:   "You cannot change your own role away from Admin",
    };
  }

  // Check for duplicate email (exclude current user)
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== id) {
    return {
      success:     false,
      error:       "A user with this email already exists",
      fieldErrors: { email: "This email is already taken" },
    };
  }

  try {
    const data: Prisma.UserUpdateInput = { email, name, role };

    // Only update password if provided
    if (password) {
      data.passwordHash = await hash(password, 12);
    }

    await prisma.user.update({ where: { id }, data });
    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "User not found." };
    }
    console.error("[updateUser]", err);
    return { success: false, error: "Failed to update user. Please try again." };
  }
}

// ─── Delete user ─────────────────────────────────────────────────────────────

export async function deleteUser(id: string): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  // Prevent deleting yourself
  const session = await getSession();
  if (session?.user.id === id) {
    return { success: false, error: "You cannot delete your own account" };
  }

  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "User not found." };
    }
    console.error("[deleteUser]", err);
    return { success: false, error: "Failed to delete user. Please try again." };
  }
}
