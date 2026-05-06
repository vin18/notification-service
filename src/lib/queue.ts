import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { redis } from "./redis.js";

export const notificationQueueName = env.NOTIFICATION_QUEUE_NAME;

export const notificationQueue = new Queue(notificationQueueName, {
  connection: redis
});

export const bullmqConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export type NotificationJobData = {
  notificationId: string;
};

export async function enqueueNotificationJob(data: NotificationJobData, scheduledAt?: Date | null) {
  const delayMs = scheduledAt
    ? Math.max(scheduledAt.getTime() - Date.now(), 0)
    : 0;

  return notificationQueue.add("deliver-notification", data, {
    delay: delayMs,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  });
}

export function createNotificationWorker(
  processor: ConstructorParameters<typeof Worker<NotificationJobData>>[1]
) {
  return new Worker<NotificationJobData>(notificationQueueName, processor, {
    connection: bullmqConnection,
    concurrency: 10
  });
}
