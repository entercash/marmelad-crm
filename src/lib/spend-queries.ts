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
 * Bridge: AdAccount.externalId → integration_settings (taboola.<accountId>.taboolaAccountId) → Account.
 * Commission = (1 + commissionPercent/100) × (1 + cryptoPaymentPercent/100).
 * Falls back to Agency commission if Account has no override.
 * Falls back to 1 (no commission) if no Account or Agency is linked.
 *
 * Output columns: "adAccountId", "multiplier"
 *
 * Usage: prepend to any query, then JOIN acct_mult am ON am."adAccountId" = aa."id"
 */
const ACCT_MULT_BODY = Prisma.sql`
    SELECT
      aa."id" AS "adAccountId",
      (1 + COALESCE(a."commissionPercent", ag."commissionPercent", 0) / 100) *
      (1 + COALESCE(a."cryptoPaymentPercent", ag."cryptoPaymentPercent", 0) / 100) AS multiplier
    FROM "ad_accounts" aa
    LEFT JOIN "integration_settings" iset
      ON iset."value" = aa."externalId"
      AND iset."key" LIKE 'taboola.%.taboolaAccountId'
    LEFT JOIN "accounts" a
      ON a."id" = SUBSTRING(iset."key" FROM 'taboola\\.(.+)\\.taboolaAccountId')
    LEFT JOIN "agencies" ag ON ag."id" = COALESCE(a."agencyId", aa."agencyId")
`;

export const ACCT_MULT_CTE = Prisma.sql`WITH acct_mult AS (${ACCT_MULT_BODY})`;

/**
 * Same as ACCT_MULT_CTE but as a sub-CTE (no WITH keyword) for embedding
 * inside existing CTEs.
 */
export const ACCT_MULT_SUB_CTE = Prisma.sql`acct_mult AS (${ACCT_MULT_BODY})`;

/**
 * SQL CASE expression that converts campaign_stats_daily.spend from native
 * currency to USD. Use inside SUM(): SUM(csd."spend" / ${FX_TO_USD_CASE})
 *
 * Hardcoded fallback rates — close enough for performance marketing P&L.
 * Rates are "units of foreign currency per 1 USD" (divide to get USD).
 */
export const FX_TO_USD_CASE = Prisma.sql`
  CASE csd."currency"
    WHEN 'USD' THEN 1.0
    WHEN 'HKD' THEN 7.80
    WHEN 'EUR' THEN 0.92
    WHEN 'GBP' THEN 0.79
    WHEN 'ILS' THEN 3.65
    WHEN 'BRL' THEN 5.00
    WHEN 'JPY' THEN 150.0
    ELSE 1.0
  END
`;
