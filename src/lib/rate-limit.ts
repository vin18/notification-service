import type { Request, Response, NextFunction } from "express";

import { env } from "../config/env.js";
import { HttpError } from "./http-errors.js";
import { redis } from "./redis.js";

function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.ip || request.socket.remoteAddress || "unknown";
}

export async function notificationRateLimitMiddleware(request: Request, response: Response, next: NextFunction) {
  try {
    const clientId = getClientIdentifier(request);
    const key = `rate_limit:notifications:${clientId}`;
    const windowSeconds = env.RATE_LIMIT_WINDOW_SECONDS;
    const maxRequests = env.RATE_LIMIT_MAX_REQUESTS;

    const results = await redis
      .multi()
      .incr(key)
      .expire(key, windowSeconds, "NX")
      .ttl(key)
      .exec();

    const requestCount = Number(results?.[0]?.[1] ?? 0);
    const ttlSeconds = Number(results?.[2]?.[1] ?? windowSeconds);
    const remaining = Math.max(maxRequests - requestCount, 0);

    response.setHeader("X-RateLimit-Limit", String(maxRequests));
    response.setHeader("X-RateLimit-Remaining", String(remaining));
    response.setHeader("X-RateLimit-Reset", String(ttlSeconds > 0 ? ttlSeconds : windowSeconds));

    if (requestCount > maxRequests) {
      throw new HttpError(429, "Rate limit exceeded");
    }

    next();
  } catch (error) {
    next(error);
  }
}
