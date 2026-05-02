import { Redis } from "ioredis";

import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true
});

export async function checkRedisHealth(): Promise<void> {
  const result = await redis.ping();

  if (result !== "PONG") {
    throw new Error("Unexpected Redis ping response");
  }
}
