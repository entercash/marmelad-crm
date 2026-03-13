-- Widen Decimal(10,6) → Decimal(16,6) for rate/metric columns
-- to prevent numeric overflow when values exceed 9999.999999

ALTER TABLE "taboola_csv_rows"
  ALTER COLUMN "actualCpc"      TYPE DECIMAL(16, 6),
  ALTER COLUMN "actualCpa"      TYPE DECIMAL(16, 6),
  ALTER COLUMN "cpm"            TYPE DECIMAL(16, 6),
  ALTER COLUMN "ctr"            TYPE DECIMAL(16, 6),
  ALTER COLUMN "conversionRate" TYPE DECIMAL(16, 6),
  ALTER COLUMN "roas"           TYPE DECIMAL(16, 6);
