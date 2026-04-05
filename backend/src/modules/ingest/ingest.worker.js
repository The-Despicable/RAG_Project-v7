import { claimNextQueuedJob, failIngestJob, processIngestJob, resetStuckJobs } from "./ingest.service.js";

const pollIntervalMs = Number(process.env.INGEST_POLL_INTERVAL_MS || 1000);
const jobTimeoutMs = Number(process.env.INGEST_JOB_TIMEOUT_MS || 120000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWorkerLoop(logger = console) {
  logger.info?.(`Ingestion worker polling every ${pollIntervalMs}ms`);
  logger.info?.(`Job timeout set to ${jobTimeoutMs}ms`);

  try {
    const resetCount = await resetStuckJobs();
    if (resetCount > 0) {
      logger.info?.(`Reset ${resetCount} stuck job(s) from previous crash`);
    }
  } catch (error) {
    logger.error?.(`Failed to reset stuck jobs: ${error.message}`);
  }

  while (true) {
    try {
      const job = await claimNextQueuedJob();
      if (!job) {
        await sleep(pollIntervalMs);
        continue;
      }

      logger.info?.(`Processing ingest job ${job.id}`);
      try {
        const timeout = setTimeout(async () => {
          await failIngestJob(job, new Error(`Job timed out after ${jobTimeoutMs}ms`));
          logger.error?.(`Ingest job ${job.id} timed out`);
        }, jobTimeoutMs);

        await processIngestJob(job);
        clearTimeout(timeout);
        logger.info?.(`Completed ingest job ${job.id}`);
      } catch (error) {
        await failIngestJob(job, error);
        logger.error?.(`Failed ingest job ${job.id}: ${error.message}`);
      }
    } catch (error) {
      logger.error?.(`Worker loop error: ${error.message}`);
      await sleep(pollIntervalMs);
    }
  }
}
