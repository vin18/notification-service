import { Router } from "express";

import { serializeNotification } from "../modules/notifications/notifications.presenter.js";
import { notificationsAcceptedTotal } from "../lib/metrics.js";
import {
  createNotificationSchema,
  failedNotificationsQuerySchema,
  notificationParamsSchema
} from "../modules/notifications/notifications.schemas.js";
import {
  createNotification,
  getFailedNotifications,
  getNotificationById
} from "../modules/notifications/notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.post("/", async (request, response, next) => {
  try {
    const input = createNotificationSchema.parse(request.body);
    const result = await createNotification(input);

    notificationsAcceptedTotal.inc({
      tenant_id: result.notification.tenantId,
      channel: result.notification.channel,
      duplicate: String(result.duplicate)
    });

    request.log.info(
      {
        notificationId: result.notification.id,
        tenantId: result.notification.tenantId,
        userId: result.notification.userId,
        queueJobId: result.queueJobId ?? null,
        duplicate: result.duplicate
      },
      "Notification accepted"
    );

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

notificationsRouter.get("/failed", async (request, response, next) => {
  try {
    const query = failedNotificationsQuerySchema.parse(request.query);
    const notifications = await getFailedNotifications(query);

    request.log.info(
      {
        tenantId: query.tenantId ?? null,
        limit: query.limit,
        failedCount: notifications.length
      },
      "Fetched failed notifications"
    );

    response.json({
      data: notifications.map(serializeNotification)
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

    request.log.info(
      {
        notificationId: notification.id,
        tenantId: notification.tenantId,
        userId: notification.userId,
        status: notification.status
      },
      "Fetched notification"
    );

    response.json({
      data: serializeNotification(notification)
    });
  } catch (error) {
    next(error);
  }
});
