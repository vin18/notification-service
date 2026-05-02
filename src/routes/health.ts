import { Router } from "express";

import { env } from "../config/env.js";
import { checkPostgresHealth } from "../lib/postgres.js";
import { checkRedisHealth } from "../lib/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  const checks = await Promise.allSettled([
    checkPostgresHealth(),
    checkRedisHealth()
  ]);

  const postgresOk = checks[0].status === "fulfilled";
  const redisOk = checks[1].status === "fulfilled";
  const isHealthy = postgresOk && redisOk;

  response.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    service: "notification-service",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres: postgresOk ? "ok" : "error",
      redis: redisOk ? "ok" : "error"
    }
  });
});
