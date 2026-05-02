import { Channel } from "@prisma/client";
import { z } from "zod";

export const createNotificationSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  userEmail: z.string().trim().email(),
  channel: z.nativeEnum(Channel).default(Channel.EMAIL),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  scheduledAt: z.coerce.date().optional(),
  idempotencyKey: z.string().trim().min(1).max(120)
}).superRefine((value, ctx) => {
  if (value.scheduledAt && value.scheduledAt.getTime() < Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scheduledAt"],
      message: "scheduledAt must be in the future"
    });
  }
});

export const notificationParamsSchema = z.object({
  id: z.string().trim().min(1)
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
