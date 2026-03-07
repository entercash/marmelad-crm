/**
 * Keitaro BullMQ Job Handlers
 *
 * Thin validation + delegation layer.
 * All business logic lives in keitaro.sync.ts.
 */

import type { Job } from "bullmq";
import { ValidationError } from "@/lib/errors";
import { isValidDateStr } from "@/lib/date";
import type { KeitaroJobPayload } from "@/jobs/types";
import { syncKeitaroConversionStatsDaily } from "@/services/sync/keitaro.sync";

// ─── Main router ──────────────────────────────────────────────────────────────

export async function handleKeitaroJob(
  job: Job<KeitaroJobPayload>,
): Promise<void> {
  const { data } = job;

  switch (data.type) {
    case "keitaro:conversion-stats-daily":
      return handleConversionStats(job as Job<typeof data>);

    default: {
      const _exhaustive: never = data;
      throw new ValidationError(`Unknown Keitaro job type: ${JSON.stringify(_exhaustive)}`);
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
