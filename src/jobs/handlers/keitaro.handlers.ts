/**
 * Keitaro BullMQ Job Handlers
 *
 * Thin validation + delegation layer.
 * All business logic lives in keitaro.sync.ts.
 */

import type { Job } from "bullmq";
import { ValidationError } from "../../lib/errors";
import { isValidDateStr } from "../../lib/date";
import type { KeitaroJobPayload } from "../types";
import { syncKeitaroConversionStatsDaily } from "../../services/sync/keitaro.sync";

// ─── Main router ──────────────────────────────────────────────────────────────

export async function handleKeitaroJob(
  job: Job<KeitaroJobPayload>,
): Promise<void> {
  const { data } = job;

  switch (data.type) {
    case "keitaro:conversion-stats-daily":
      return handleConversionStats(job as Job<typeof data>);

    default: {
      // Note: KeitaroJobPayload is currently a single-variant type alias, not a union.
      // TypeScript can only narrow a switch default to `never` when the discriminant
      // belongs to an actual union type (A | B | C). A single-type alias leaves `data`
      // typed as KeitaroConversionStatsDailyPayload in the default branch, so the
      // `never` exhaustiveness variable would be a type error. When a second payload
      // variant is added (making KeitaroJobPayload a real union), restore the check:
      //   const _exhaustive: never = data;
      throw new ValidationError(`Unknown Keitaro job type: ${JSON.stringify(data)}`);
    }
  }
}

// ─── Individual handlers ──────────────────────────────────────────────────────

async function handleConversionStats(
  job: Job<{
    type: "keitaro:conversion-stats-daily";
    startDate: string;
    endDate: string;
  }>,
): Promise<void> {
  const { startDate, endDate } = job.data;

  if (!isValidDateStr(startDate)) throw new ValidationError(`Invalid startDate: ${startDate}`);
  if (!isValidDateStr(endDate)) throw new ValidationError(`Invalid endDate: ${endDate}`);
  if (startDate > endDate) throw new ValidationError("startDate must be <= endDate");

  console.log(
    `[keitaro:conversion-stats-daily] Starting | ${startDate}→${endDate} | jobId=${job.id}`,
  );

  const result = await syncKeitaroConversionStatsDaily({
    dateRange: { startDate, endDate },
  });

  console.log(
    `[keitaro:conversion-stats-daily] Done | fetched=${result.recordsFetched} updated=${result.recordsUpdated} skipped=${result.recordsSkipped} failed=${result.recordsFailed} | syncLogId=${result.syncLogId}`,
  );
}
