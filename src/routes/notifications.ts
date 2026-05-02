import { Router } from "express";

import { createNotificationSchema, notificationParamsSchema } from "../modules/notifications/notifications.schemas.js";
import { createNotification, getNotificationById } from "../modules/notifications/notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.post("/", async (request, response, next) => {
  try {
    const input = createNotificationSchema.parse(request.body);
    const result = await createNotification(input);

    response.status(202).json({
      data: serializeNotification(result.notification),
      meta: {
        duplicate: result.duplicate,
        queueJobId: result.queueJobId ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/:id", async (request, response, next) => {
  try {
    const { id } = notificationParamsSchema.parse(request.params);
    const notification = await getNotificationById(id);

    if (!notification) {
      response.status(404).json({
        error: "Notification not found"
      });
      return;
    }

    response.json({
      data: serializeNotification(notification)
    });
  } catch (error) {
    next(error);
  }
});

function serializeNotification(notification: {
  id: string;
  tenantId: string;
  userId: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  failureReason: string | null;
  providerMessageId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...notification,
    scheduledAt: notification.scheduledAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString()
  };
}
