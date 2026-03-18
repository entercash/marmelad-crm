/**
 * Domain BullMQ Job Handlers
 *
 * Delegates to the domain monitor service.
 */

import type { Job } from "bullmq";
import type { DomainCheckAllPayload } from "../types";

export async function handleDomainJob(
  job: Job<DomainCheckAllPayload>,
): Promise<void> {
  console.log(`[domain:check-all] Starting | jobId=${job.id}`);

  const { checkAllDomains } = await import(
    "../../services/domain-monitor"
  );
  const alerts = await checkAllDomains();

  console.log(
    `[domain:check-all] Done | alerts=${alerts}`,
  );
}
