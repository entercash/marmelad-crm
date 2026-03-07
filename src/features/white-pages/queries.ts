/**
 * White Pages — database queries.
 *
 * WhitePageRow — full row shape; `transferDate` is a JS Date.
 *   Safe for server components (they can serialise Date → string themselves).
 *
 * WhitePageEditData — subset safe for client component props:
 *   `transferDate` converted to "YYYY-MM-DD" string so it crosses the
 *   server→client boundary without triggering the "Date cannot be passed to
 *   client components" error.
 */

import { WhitePageStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type { WhitePageStatus };

// ─── Row types ────────────────────────────────────────────────────────────────

export type WhitePageRow = {
  id:              string;
  transferDate:    Date;
  geo:             string;
  url:             string;
  topic:           string | null;
  zohoEmail:       string | null;
  password:        string | null;
  legalEntityData: string | null;
  taxNumber:       string | null;
  status:          WhitePageStatus;
  updatedAt:       Date;
};

/**
 * Safe to pass as props to client components — no Date objects.
 * transferDate is pre-formatted as "YYYY-MM-DD" for the date input.
 */
export type WhitePageEditData = {
  id:              string;
  transferDate:    string; // "YYYY-MM-DD"
  geo:             string;
  url:             string;
  topic:           string | null;
  zohoEmail:       string | null;
  password:        string | null;
  legalEntityData: string | null;
  taxNumber:       string | null;
  status:          WhitePageStatus;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all white pages ordered by transfer date descending (most recent first),
 * with a secondary sort by createdAt for stable ordering within the same date.
 */
export async function getWhitePages(): Promise<WhitePageRow[]> {
  return prisma.whitePage.findMany({
    orderBy: [
      { transferDate: "desc" },
      { createdAt:    "desc" },
    ],
    select: {
      id:              true,
      transferDate:    true,
      geo:             true,
      url:             true,
      topic:           true,
      zohoEmail:       true,
      password:        true,
      legalEntityData: true,
      taxNumber:       true,
      status:          true,
      updatedAt:       true,
    },
  });
}
