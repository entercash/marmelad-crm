/**
 * Taboola CSV parser — converts Dartmatics CSV export text into
 * structured rows ready for database upsert.
 *
 * Handles:
 *  - RFC-4180 CSV (quoted fields with commas/newlines inside)
 *  - Date parsing: "Mar 09, 2026" → Date
 *  - Percentage stripping: "12.34%" → 0.1234
 *  - Empty / "None" → null for optional fields
 *  - Decimal parsing with locale-safe handling
 */

// ─── CSV Column → DB Field Mapping ──────────────────────────────────────────

const COLUMN_MAP: Record<string, string> = {
  "Account Name":             "accountName",
  "Account ID":               "accountExternalId",
  "Campaign Name":            "campaignName",
  "Campaign ID":              "campaignExternalId",
  "Campaign Status":          "campaignStatus",
  "Campaign Bid":             "campaignBid",
  "Campaign Bidding Strategy": "campaignBidStrategy",
  "Campaign Start Date":      "campaignStartDate",
  "Conversion Goal":          "conversionGoal",
  "Ad ID":                    "adExternalId",
  "Ad Title":                 "adTitle",
  "Ad Description":           "adDescription",
  "Day":                      "day",
  "Ad Status":                "adStatus",
  "Country":                  "country",
  "Site":                     "siteName",
  "Site URL":                 "siteUrl",
  "Site ID":                  "siteExternalId",
  "Currency":                 "currency",
  "Inventory Type":           "inventoryType",
  "Country Code":             "countryCode",
  "Campaign Budget Type":     "campaignBudgetType",
  "Spending Limit":           "spendingLimit",
  "Campaign Budget":          "campaignBudget",
  "Spending Limit Type":      "spendingLimitType",
  "Actual CPA":               "actualCpa",
  "Actual CPC":               "actualCpc",
  "Clicks":                   "clicks",
  "Conversion Rate":          "conversionRate",
  "Conversions":              "conversions",
  "Conversions Value":        "conversionsValue",
  "CPM":                      "cpm",
  "CTR":                      "ctr",
  "Impressions":              "impressions",
  "ROAS":                     "roas",
  "Served Ads":               "servedAds",
  "Spent":                    "spent",
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaboolaCsvRowInput {
  day:                 Date;
  campaignExternalId:  string;
  adExternalId:        string;
  siteExternalId:      string;
  countryCode:         string;
  accountName:         string;
  accountExternalId:   string;
  campaignName:        string;
  campaignStatus:      string;
  campaignBid:         number | null;
  campaignBidStrategy: string | null;
  campaignStartDate:   string | null;
  conversionGoal:      string | null;
  campaignBudgetType:  string | null;
  campaignBudget:      number | null;
  spendingLimit:       number | null;
  spendingLimitType:   string | null;
  adTitle:             string;
  adDescription:       string | null;
  adStatus:            string;
  siteName:            string;
  siteUrl:             string | null;
  country:             string;
  currency:            string;
  inventoryType:       string | null;
  spent:               number;
  clicks:              number;
  impressions:         number;
  conversions:         number;
  conversionsValue:    number;
  servedAds:           number;
  actualCpc:           number | null;
  actualCpa:           number | null;
  cpm:                 number | null;
  ctr:                 number | null;
  conversionRate:      number | null;
  roas:                number | null;
}

export interface ParseResult {
  rows:   TaboolaCsvRowInput[];
  errors: string[];
}

// ─── Date parsing ───────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** "Mar 09, 2026" → Date(2026-03-09 UTC) */
function parseTaboolaDate(raw: string): Date | null {
  // Format: "Mon DD, YYYY" — possibly with quotes
  const cleaned = raw.replace(/"/g, "").trim();
  const m = cleaned.match(/^(\w{3})\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[1]];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[2])));
}

// ─── Number parsing ─────────────────────────────────────────────────────────

/** Parse a numeric string; strip trailing %, handle "None"/empty → null. */
function parseDecimal(raw: string): number | null {
  const s = raw.trim();
  if (!s || s === "None" || s === "-") return null;
  // Strip thousand-separator commas (e.g. "1,228.72" → "1228.72")
  const stripped = s.replace(/%$/, "").replace(/,/g, "");
  const n = Number(stripped);
  if (Number.isNaN(n)) return null;
  // If the original had %, convert from percentage to ratio (12.34% → 0.1234)
  if (s.endsWith("%")) return n / 100;
  return n;
}

/** Parse an integer string, return 0 for empty/invalid. */
function parseInt_(raw: string): number {
  // Strip thousand-separator commas (e.g. "1,234" → "1234")
  const n = parseInt(raw.trim().replace(/,/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Empty / "None" → null, otherwise trimmed string. */
function parseOptionalString(raw: string): string | null {
  const s = raw.trim();
  if (!s || s === "None") return null;
  return s;
}

// ─── RFC-4180 CSV parser ────────────────────────────────────────────────────

/**
 * Parses a CSV string into an array of string arrays.
 * Handles quoted fields containing commas, newlines, and escaped quotes.
 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row: string[] = [];
    // Parse each field in the row
    while (i < len) {
      let field = "";
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              // Escaped quote
              field += '"';
              i += 2;
            } else {
              // End of quoted field
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
      } else {
        // Unquoted field — read until comma or newline
        while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i];
          i++;
        }
      }

      row.push(field);

      // Check what follows
      if (i < len && text[i] === ',') {
        i++; // skip comma, continue to next field
        continue;
      }
      // End of row (newline or end of string)
      break;
    }

    // Skip newline(s)
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;

    // Skip completely empty trailing rows
    if (row.length === 1 && row[0] === "" && i >= len) break;

    rows.push(row);
  }

  return rows;
}

// ─── Main parser ────────────────────────────────────────────────────────────

export function parseTaboolaCsv(csvText: string): ParseResult {
  const rawRows = parseCsvText(csvText);
  if (rawRows.length === 0) {
    return { rows: [], errors: ["CSV file is empty"] };
  }

  // Map header to field names
  const headerRow = rawRows[0];
  const fieldNames: (string | null)[] = headerRow.map((h) => COLUMN_MAP[h.trim()] ?? null);

  const unknownCols = headerRow.filter((h) => !COLUMN_MAP[h.trim()]);
  const errors: string[] = [];
  if (unknownCols.length > 0) {
    errors.push(`Unknown columns ignored: ${unknownCols.join(", ")}`);
  }

  // Check required columns exist
  const requiredFields = [
    "day", "campaignExternalId", "adExternalId", "siteExternalId",
    "countryCode", "accountName", "accountExternalId", "campaignName",
    "campaignStatus", "adTitle", "adStatus", "siteName", "country",
  ];
  const presentFields = new Set(fieldNames.filter(Boolean));
  const missingRequired = requiredFields.filter((f) => !presentFields.has(f));
  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingRequired.join(", ")}`],
    };
  }

  // Parse data rows
  const rows: TaboolaCsvRowInput[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const cells = rawRows[r];
    // Skip empty rows
    if (cells.length <= 1 && (!cells[0] || !cells[0].trim())) continue;

    // Build a field→value map
    const record: Record<string, string> = {};
    for (let c = 0; c < fieldNames.length && c < cells.length; c++) {
      const fieldName = fieldNames[c];
      if (fieldName) record[fieldName] = cells[c];
    }

    // Parse day (required)
    const day = parseTaboolaDate(record.day ?? "");
    if (!day) {
      errors.push(`Row ${r + 1}: invalid date "${record.day}"`);
      continue;
    }

    // Required string fields
    const campaignExternalId = (record.campaignExternalId ?? "").trim();
    const adExternalId       = (record.adExternalId ?? "").trim();
    const siteExternalId     = (record.siteExternalId ?? "").trim();
    const countryCode        = (record.countryCode ?? "").trim();

    if (!campaignExternalId || !adExternalId || !siteExternalId || !countryCode) {
      errors.push(`Row ${r + 1}: missing key fields (campaign/ad/site ID or country code)`);
      continue;
    }

    rows.push({
      day,
      campaignExternalId,
      adExternalId,
      siteExternalId,
      countryCode,
      accountName:        (record.accountName ?? "").trim(),
      accountExternalId:  (record.accountExternalId ?? "").trim(),
      campaignName:       (record.campaignName ?? "").trim(),
      campaignStatus:     (record.campaignStatus ?? "").trim(),
      campaignBid:        parseDecimal(record.campaignBid ?? ""),
      campaignBidStrategy: parseOptionalString(record.campaignBidStrategy ?? ""),
      campaignStartDate:  parseOptionalString(record.campaignStartDate ?? ""),
      conversionGoal:     parseOptionalString(record.conversionGoal ?? ""),
      campaignBudgetType: parseOptionalString(record.campaignBudgetType ?? ""),
      campaignBudget:     parseDecimal(record.campaignBudget ?? ""),
      spendingLimit:      parseDecimal(record.spendingLimit ?? ""),
      spendingLimitType:  parseOptionalString(record.spendingLimitType ?? ""),
      adTitle:            (record.adTitle ?? "").trim(),
      adDescription:      parseOptionalString(record.adDescription ?? ""),
      adStatus:           (record.adStatus ?? "").trim(),
      siteName:           (record.siteName ?? "").trim(),
      siteUrl:            parseOptionalString(record.siteUrl ?? ""),
      country:            (record.country ?? "").trim(),
      currency:           (record.currency ?? "USD").trim(),
      inventoryType:      parseOptionalString(record.inventoryType ?? ""),
      spent:              parseDecimal(record.spent ?? "0") ?? 0,
      clicks:             parseInt_(record.clicks ?? "0"),
      impressions:        parseInt_(record.impressions ?? "0"),
      conversions:        parseDecimal(record.conversions ?? "0") ?? 0,
      conversionsValue:   parseDecimal(record.conversionsValue ?? "0") ?? 0,
      servedAds:          parseInt_(record.servedAds ?? "0"),
      actualCpc:          parseDecimal(record.actualCpc ?? ""),
      actualCpa:          parseDecimal(record.actualCpa ?? ""),
      cpm:                parseDecimal(record.cpm ?? ""),
      ctr:                parseDecimal(record.ctr ?? ""),
      conversionRate:     parseDecimal(record.conversionRate ?? ""),
      roas:               parseDecimal(record.roas ?? ""),
    });
  }

  return { rows, errors };
}
