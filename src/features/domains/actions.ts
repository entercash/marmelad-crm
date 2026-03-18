"use server";

import { revalidatePath } from "next/cache";
import { guardAdmin } from "@/lib/auth-guard";
import type { ActionResult } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { domainSchema } from "./schema";
import { checkDomain } from "@/services/domain-checker";

// ─── Create Domain ──────────────────────────────────────────────────────────

export async function createDomain(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const raw = {
    url: formData.get("url") as string,
    name: (formData.get("name") as string) ?? "",
    notes: (formData.get("notes") as string) ?? "",
  };

  const parsed = domainSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check for duplicate
  const existing = await prisma.domain.findUnique({
    where: { url: parsed.data.url },
  });
  if (existing) {
    return { success: false, error: "This domain is already being monitored" };
  }

  await prisma.domain.create({
    data: {
      url: parsed.data.url,
      name: parsed.data.name,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/domains");
  return { success: true };
}

// ─── Update Domain ──────────────────────────────────────────────────────────

export async function updateDomain(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const raw = {
    url: formData.get("url") as string,
    name: (formData.get("name") as string) ?? "",
    notes: (formData.get("notes") as string) ?? "",
  };

  const parsed = domainSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check for duplicate (excluding self)
  const existing = await prisma.domain.findFirst({
    where: { url: parsed.data.url, NOT: { id } },
  });
  if (existing) {
    return { success: false, error: "This domain is already being monitored" };
  }

  await prisma.domain.update({
    where: { id },
    data: {
      url: parsed.data.url,
      name: parsed.data.name,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/domains");
  return { success: true };
}

// ─── Bulk Import Domains ────────────────────────────────────────────────────

export type BulkImportResult = {
  success: true;
  added: number;
  skipped: number;
  errors: string[];
};

export async function bulkImportDomains(
  urls: string[],
): Promise<BulkImportResult | ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const rawUrl of urls) {
    const trimmed = rawUrl.trim();
    if (!trimmed) continue;

    // Normalize: add https:// if missing
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      errors.push(`Invalid URL: ${trimmed}`);
      continue;
    }

    // Skip duplicates
    const existing = await prisma.domain.findUnique({ where: { url } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.domain.create({
      data: { url },
    });
    added++;
  }

  revalidatePath("/domains");
  return { success: true, added, skipped, errors };
}

// ─── Delete Domain ──────────────────────────────────────────────────────────

export async function deleteDomain(id: string): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  await prisma.domain.delete({ where: { id } });

  revalidatePath("/domains");
  return { success: true };
}

// ─── Check Domain Now ───────────────────────────────────────────────────────

export async function checkDomainNow(
  id: string,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) return { success: false, error: "Domain not found" };

  const result = await checkDomain(domain.url);
  const now = new Date();

  await prisma.domain.update({
    where: { id },
    data: {
      status: result.status,
      httpStatus: result.httpStatus,
      responseMs: result.responseMs,
      sslExpiry: result.sslExpiry,
      sslIssuer: result.sslIssuer,
      dnsResolves: result.dnsResolves,
      registrar: result.registrar,
      domainExpiry: result.domainExpiry,
      safeBrowsing: result.safeBrowsing,
      lastCheckedAt: now,
      ...(result.status === "UP" ? { lastUpAt: now } : {}),
    },
  });

  revalidatePath("/domains");
  return { success: true };
}
