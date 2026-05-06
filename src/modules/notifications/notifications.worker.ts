import { Channel, DeliveryAttemptStatus, NotificationStatus } from "@prisma/client";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { createEmailProvider } from "../../providers/email/index.js";

const emailProvider = createEmailProvider();

export async function processNotification(notificationId: string) {
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
    return;
  }

  if (notification.status === NotificationStatus.SENT) {
    logger.info({ notificationId }, "Notification already sent, skipping duplicate job");
    return;
  }

  if (notification.channel !== Channel.EMAIL) {
    throw new Error(`Unsupported channel: ${notification.channel}`);
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

    logger.info(
      {
        notificationId,
        userId: notification.userId,
        provider: env.EMAIL_PROVIDER,
        providerMessageId: result.providerMessageId
      },
      "Notification sent successfully"
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown delivery error";

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
          status: NotificationStatus.RETRYING,
          failureReason: errorMessage
        }
      })
    ]);

    logger.error(
      {
        err: error,
        notificationId,
        userId: notification.userId,
        provider: env.EMAIL_PROVIDER,
        attemptNumber: currentAttempt
      },
      "Notification delivery failed"
    );

    throw error;
  }
}
