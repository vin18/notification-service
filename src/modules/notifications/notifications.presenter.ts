export function serializeNotification(notification: {
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
  attempts?: Array<{
    id: string;
    notificationId: string;
    attemptNumber: number;
    provider: string;
    status: string;
    errorMessage: string | null;
    startedAt: Date;
    finishedAt: Date | null;
  }>;
}) {
  return {
    ...notification,
    scheduledAt: notification.scheduledAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
    attempts: notification.attempts?.map((attempt) => ({
      ...attempt,
      startedAt: attempt.startedAt.toISOString(),
      finishedAt: attempt.finishedAt?.toISOString() ?? null
    })) ?? []
  };
}
