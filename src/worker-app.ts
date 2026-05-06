import { createNotificationWorker, bullmqConnection, notificationQueue } from "./lib/queue.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { processNotification } from "./modules/notifications/notifications.worker.js";

export function startWorker() {
  const worker = createNotificationWorker(async (job) => {
    await processNotification(job.data.notificationId);
  });

  worker.on("completed", (job) => {
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

  return worker;
}

export async function shutdownWorker(worker: Awaited<ReturnType<typeof startWorker>>) {
  await Promise.all([
    worker.close(),
    notificationQueue.close(),
    bullmqConnection.quit(),
    prisma.$disconnect(),
    redis.quit()
  ]);
}
