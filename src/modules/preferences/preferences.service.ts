import { Channel } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-errors.js";

import type { UpdatePreferenceInput } from "./preferences.schemas.js";

export async function getUserPreferences(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      preferences: true
    }
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return user.preferences;
}

export async function upsertUserPreference(userId: string, input: UpdatePreferenceInput) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    }
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return prisma.userPreference.upsert({
    where: {
      userId_channel: {
        userId,
        channel: input.channel ?? Channel.EMAIL
      }
    },
    update: {
      enabled: input.enabled
    },
    create: {
      userId,
      channel: input.channel ?? Channel.EMAIL,
      enabled: input.enabled
    }
  });
}
