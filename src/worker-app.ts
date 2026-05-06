import { createNotificationWorker, bullmqConnection, notificationQueue } from "./lib/queue.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import {
  initializeMetrics,
  notificationQueueJobsTotal,
  startMetricsServer
} from "./lib/metrics.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { processNotification } from "./modules/notifications/notifications.worker.js";

export function startWorker(options?: { metricsPort?: number | null }) {
  initializeMetrics("worker");
  const worker = createNotificationWorker(async (job) => {
    await processNotification(job.data.notificationId);
  });
  const metricsPort = options?.metricsPort ?? env.WORKER_METRICS_PORT;
  const metricsServer = metricsPort === null
    ? null
    : startMetricsServer(metricsPort, () => {
        logger.info({ port: metricsPort }, "Worker metrics server started");
      });

  worker.on("completed", (job) => {
    notificationQueueJobsTotal.inc({
      event: "completed"
    });
    logger.info(
      {
        jobId: job.id,
        notificationId: job.data.notificationId,
        attemptsMade: job.attemptsMade
      },
      "Worker completed notification job"
    );
  });

  worker.on("failed", async (job, error) => {
    if (!job) {
      logger.error({ err: error }, "Worker failed before job metadata was available");
      return;
    }
    notificationQueueJobsTotal.inc({
      event: "failed"
    });

    if (job.opts.attempts !== undefined && job.attemptsMade >= job.opts.attempts) {
      await prisma.notification.update({
        where: {
          id: job.data.notificationId
        },
        data: {
          status: "FAILED"
        }
      });
    }

    logger.error(
      {
        err: error,
        jobId: job.id,
        notificationId: job.data.notificationId,
        attemptsMade: job.attemptsMade,
        willRetry: job.opts.attempts !== undefined && job.attemptsMade < job.opts.attempts
      },
      "Worker failed notification job"
    );
  });

  logger.info("Notification worker started");

  return {
    worker,
    metricsServer
  };
}

export async function shutdownWorker(workerRuntime: Awaited<ReturnType<typeof startWorker>>) {
  const closeMetricsServer = workerRuntime.metricsServer
    ? new Promise<void>((resolve, reject) => {
        workerRuntime.metricsServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
    : Promise.resolve();

  await Promise.all([
    workerRuntime.worker.close(),
    closeMetricsServer,
    notificationQueue.close(),
    bullmqConnection.quit(),
    prisma.$disconnect(),
    redis.quit()
  ]);
}
