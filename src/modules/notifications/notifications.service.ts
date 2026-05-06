import { Channel, NotificationStatus, Prisma } from "@prisma/client";

import type { CreateNotificationInput } from "./notifications.schemas.js";
import { prisma } from "../../lib/prisma.js";
import { enqueueNotificationJob } from "../../lib/queue.js";

type CreatedNotificationResult = {
  notification: {
    id: string;
    tenantId: string;
    userId: string;
    channel: Channel;
    subject: string;
    body: string;
    status: NotificationStatus;
    scheduledAt: Date | null;
    sentAt: Date | null;
    failureReason: string | null;
    providerMessageId: string | null;
    idempotencyKey: string;
    createdAt: Date;
    updatedAt: Date;
  };
  duplicate: boolean;
  queueJobId?: string;
};

export async function createNotification(input: CreateNotificationInput): Promise<CreatedNotificationResult> {
  try {
    const notification = await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: {
          id: input.userId
        },
        update: {
          email: input.userEmail,
          tenantId: input.tenantId
        },
        create: {
          id: input.userId,
          email: input.userEmail,
          tenantId: input.tenantId
        }
      });

      await tx.userPreference.upsert({
        where: {
          userId_channel: {
            userId: input.userId,
            channel: Channel.EMAIL
          }
        },
        update: {},
        create: {
          userId: input.userId,
          channel: Channel.EMAIL,
          enabled: true
        }
      });

      return tx.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          channel: input.channel,
          subject: input.subject,
          body: input.body,
          scheduledAt: input.scheduledAt,
          idempotencyKey: input.idempotencyKey,
          status: NotificationStatus.PENDING
        }
      });
    });

    const job = await enqueueNotificationJob(
      { notificationId: notification.id },
      notification.scheduledAt
    );

    return {
      notification,
      duplicate: false,
      queueJobId: job.id ?? undefined
    };
  } catch (error) {
    if (isNotificationIdempotencyConflict(error)) {
      const existingNotification = await prisma.notification.findUniqueOrThrow({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: input.idempotencyKey
          }
        }
      });

      return {
        notification: existingNotification,
        duplicate: true
      };
    }

    throw error;
  }
}

export async function getNotificationById(id: string) {
  return prisma.notification.findUnique({
    where: { id },
    include: {
      attempts: {
        orderBy: {
          attemptNumber: "asc"
        }
      }
    }
  });
}

export async function getFailedNotifications(input: { limit: number; tenantId?: string }) {
  return prisma.notification.findMany({
    where: {
      status: NotificationStatus.FAILED,
      ...(input.tenantId ? { tenantId: input.tenantId } : {})
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: input.limit,
    include: {
      attempts: {
        orderBy: {
          attemptNumber: "asc"
        }
      }
    }
  });
}

function isNotificationIdempotencyConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
    && Array.isArray(error.meta?.target)
    && error.meta.target.includes("tenant_id")
    && error.meta.target.includes("idempotency_key");
}
