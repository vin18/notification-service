import { Channel } from "@prisma/client";
import { z } from "zod";

export const userParamsSchema = z.object({
  id: z.string().trim().min(1)
});

export const updatePreferenceSchema = z.object({
  channel: z.nativeEnum(Channel).default(Channel.EMAIL),
  enabled: z.boolean()
});

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
