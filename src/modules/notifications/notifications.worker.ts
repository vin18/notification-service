import { Channel, DeliveryAttemptStatus, NotificationStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import {
  notificationDeliveryAttemptsTotal,
  notificationDeliveryDurationMs,
  notificationQueueInFlight,
  notificationStatusTransitionsTotal
} from "../../lib/metrics.js";
import { prisma } from "../../lib/prisma.js";
import { EmailDeliveryError } from "../../providers/email/errors.js";
import { createEmailProvider } from "../../providers/email/index.js";

const emailProvider = createEmailProvider();

export async function processNotification(notificationId: string) {
  const processingStartedAt = performance.now();
  notificationQueueInFlight.inc();

  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId
    },
    include: {
      user: true
    }
  });

  if (!notification) {
    logger.warn({ notificationId }, "Notification not found for job");
    notificationQueueInFlight.dec();
    return;
  }

  if (notification.status === NotificationStatus.SENT) {
    logger.info({ notificationId }, "Notification already sent, skipping duplicate job");
    notificationQueueInFlight.dec();
    return;
  }

  if (notification.channel !== Channel.EMAIL) {
    throw new UnrecoverableError(`Unsupported channel: ${notification.channel}`);
  }

  if (notification.scheduledAt && notification.scheduledAt.getTime() > Date.now()) {
    logger.info(
      { notificationId, scheduledAt: notification.scheduledAt.toISOString() },
      "Notification job arrived before scheduled time, leaving for delayed processing"
    );
    notificationQueueInFlight.dec();
    return;
  }

  const preference = await prisma.userPreference.findUnique({
    where: {
      userId_channel: {
        userId: notification.userId,
        channel: Channel.EMAIL
      }
    }
  });

  if (preference && !preference.enabled) {
    await prisma.notification.update({
      where: {
        id: notificationId
      },
      data: {
        status: NotificationStatus.SKIPPED,
        failureReason: "User has disabled email notifications"
      }
    });

    logger.info({ notificationId, userId: notification.userId }, "Notification skipped due to preferences");
    notificationStatusTransitionsTotal.inc({
      status: NotificationStatus.SKIPPED
    });
    notificationQueueInFlight.dec();
    return;
  }

  await prisma.notification.update({
    where: {
      id: notificationId
    },
    data: {
      status: NotificationStatus.PROCESSING,
      failureReason: null
    }
  });
  notificationStatusTransitionsTotal.inc({
    status: NotificationStatus.PROCESSING
  });

  const currentAttempt = await prisma.deliveryAttempt.count({
    where: {
      notificationId
    }
  }) + 1;

  const attempt = await prisma.deliveryAttempt.create({
    data: {
      notificationId,
      attemptNumber: currentAttempt,
      provider: env.EMAIL_PROVIDER,
      status: DeliveryAttemptStatus.FAILURE
    }
  });

  try {
    const result = await emailProvider.send({
      to: notification.user.email,
      from: env.EMAIL_FROM,
      subject: notification.subject,
      html: notification.body
    });

    await prisma.$transaction([
      prisma.deliveryAttempt.update({
        where: {
          id: attempt.id
        },
        data: {
          status: DeliveryAttemptStatus.SUCCESS,
          finishedAt: new Date(),
          errorMessage: null
        }
      }),
      prisma.notification.update({
        where: {
          id: notificationId
        },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
          failureReason: null
        }
      })
    ]);
    notificationDeliveryAttemptsTotal.inc({
      provider: env.EMAIL_PROVIDER,
      outcome: "success",
      retryable: "false"
    });
    notificationDeliveryDurationMs.observe(
      {
        provider: env.EMAIL_PROVIDER,
        outcome: "success"
      },
      performance.now() - processingStartedAt
    );
    notificationStatusTransitionsTotal.inc({
      status: NotificationStatus.SENT
    });

    logger.info(
      {
        notificationId,
        userId: notification.userId,
        provider: env.EMAIL_PROVIDER,
        providerMessageId: result.providerMessageId,
        tenantId: notification.tenantId,
        attemptNumber: currentAttempt
      },
      "Notification sent successfully"
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown delivery error";
    const retryable = error instanceof EmailDeliveryError
      ? error.retryable
      : true;

    await prisma.$transaction([
      prisma.deliveryAttempt.update({
        where: {
          id: attempt.id
        },
        data: {
          status: DeliveryAttemptStatus.FAILURE,
          errorMessage,
          finishedAt: new Date()
        }
      }),
      prisma.notification.update({
        where: {
          id: notificationId
        },
        data: {
          status: retryable ? NotificationStatus.RETRYING : NotificationStatus.FAILED,
          failureReason: errorMessage
        }
      })
    ]);
    notificationDeliveryAttemptsTotal.inc({
      provider: env.EMAIL_PROVIDER,
      outcome: "failure",
      retryable: String(retryable)
    });
    notificationDeliveryDurationMs.observe(
      {
        provider: env.EMAIL_PROVIDER,
        outcome: "failure"
      },
      performance.now() - processingStartedAt
    );
    notificationStatusTransitionsTotal.inc({
      status: retryable ? NotificationStatus.RETRYING : NotificationStatus.FAILED
    });

    logger.error(
      {
        err: error,
        notificationId,
        userId: notification.userId,
        provider: env.EMAIL_PROVIDER,
        attemptNumber: currentAttempt,
        tenantId: notification.tenantId
      },
      "Notification delivery failed"
    );

    if (!retryable) {
      notificationQueueInFlight.dec();
      throw new UnrecoverableError(errorMessage);
    }

    notificationQueueInFlight.dec();
    throw error;
  }

  notificationQueueInFlight.dec();
}
