import { Worker, Job } from "bullmq";
import { getRedisConnection } from "@/infrastructure/redis/connection";

export interface WorkerConfig {
  queueName: string;
  concurrency?: number;
  limiter?: { max: number; duration: number };
}

export function createWorker<T>(
  config: WorkerConfig,
  processor: (job: Job<T>) => Promise<void>
): Worker<T> {
  const connection = getRedisConnection();

  const worker = new Worker<T>(
    config.queueName,
    async (job) => {
      const startTime = Date.now();
      const tenantId = (job.data as Record<string, unknown>).tenantId as string;

      console.log(
        `[Worker:${config.queueName}] Processing job ${job.id} for tenant ${tenantId}`
      );

      try {
        await processor(job);
        const duration = Date.now() - startTime;
        console.log(
          `[Worker:${config.queueName}] Completed job ${job.id} in ${duration}ms`
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(
          `[Worker:${config.queueName}] Failed job ${job.id} after ${duration}ms:`,
          error instanceof Error ? error.message : error
        );
        throw error;
      }
    },
    {
      connection,
      concurrency: config.concurrency ?? 5,
      limiter: config.limiter,
    }
  );

  worker.on("failed", (job, error) => {
    if (job) {
      console.error(
        `[Worker:${config.queueName}] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 3}):`,
        error.message
      );
    }
  });

  worker.on("error", (error) => {
    console.error(`[Worker:${config.queueName}] Worker error:`, error.message);
  });

  return worker;
}
