import { Queue } from "bullmq";

import { env } from "../config/env.js";
import { redis } from "./redis.js";

export const notificationQueueName = env.NOTIFICATION_QUEUE_NAME;

export const notificationQueue = new Queue(notificationQueueName, {
  connection: redis
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
    removeOnComplete: 1000,
    removeOnFail: 5000
  });
}
