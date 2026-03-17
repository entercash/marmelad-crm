/**
 * Shared SQL building blocks for spend queries.
 *
 * Provides commission multiplier CTE that bridges the API path
 * (CampaignStatsDaily → Campaign → AdAccount) to the Account/Agency
 * commission structure.
 *
 * Bridge: AdAccount.externalId = Account.externalId (both store Taboola account ID).
 */

import { Prisma } from "@prisma/client";

/**
 * CTE that computes a commission multiplier per AdAccount.
 *
 * Joins: AdAccount → Account (via externalId match) → Agency.
 * Commission = (1 + commissionPercent/100) × (1 + cryptoPaymentPercent/100).
 * Falls back to Agency commission if Account has no override.
 * Falls back to 1 (no commission) if no Account or Agency is linked.
 *
 * Output columns: "adAccountId", "multiplier"
 *
 * Usage: prepend to any query, then JOIN acct_mult am ON am."adAccountId" = aa."id"
 */
export const ACCT_MULT_CTE = Prisma.sql`
  WITH acct_mult AS (
    SELECT
      aa."id" AS "adAccountId",
      (1 + COALESCE(a."commissionPercent", ag."commissionPercent", 0) / 100) *
      (1 + COALESCE(a."cryptoPaymentPercent", ag."cryptoPaymentPercent", 0) / 100) AS multiplier
    FROM "ad_accounts" aa
    LEFT JOIN "accounts" a ON a."externalId" = aa."externalId"
    LEFT JOIN "agencies" ag ON ag."id" = COALESCE(a."agencyId", aa."agencyId")
  )
`;

/**
 * Same as ACCT_MULT_CTE but as a sub-CTE (no WITH keyword) for embedding
 * inside existing CTEs.
 */
export const ACCT_MULT_SUB_CTE = Prisma.sql`
  acct_mult AS (
    SELECT
      aa."id" AS "adAccountId",
      (1 + COALESCE(a."commissionPercent", ag."commissionPercent", 0) / 100) *
      (1 + COALESCE(a."cryptoPaymentPercent", ag."cryptoPaymentPercent", 0) / 100) AS multiplier
    FROM "ad_accounts" aa
    LEFT JOIN "accounts" a ON a."externalId" = aa."externalId"
    LEFT JOIN "agencies" ag ON ag."id" = COALESCE(a."agencyId", aa."agencyId")
  )
`;
