import crypto from "node:crypto";

import cors from "cors";
import express from "express";
import type { Request } from "express";
import { pinoHttp } from "pino-http";

import { logger } from "./lib/logger.js";
import { HttpError } from "./lib/http-errors.js";
import { healthRouter } from "./routes/health.js";
import { notificationsRouter } from "./routes/notifications.js";
import { preferencesRouter } from "./routes/preferences.js";
import { ZodError } from "zod";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (request: Request) => {
        const headerRequestId = request.headers["x-request-id"];
        return typeof headerRequestId === "string" && headerRequestId.length > 0
          ? headerRequestId
          : crypto.randomUUID();
      }
    })
  );

  app.get("/", (_request, response) => {
    response.json({
      name: "notification-service",
      version: "0.1.0",
      message: "Notification service foundation is running"
    });
  });

  app.use("/health", healthRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/users", preferencesRouter);

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "Invalid request",
        details: error.flatten()
      });
      return;
    }

    if (error instanceof HttpError) {
      response.status(error.statusCode).json({
        error: error.message
      });
      return;
    }

    logger.error({ err: error }, "Unhandled application error");

    response.status(500).json({
      error: "Internal Server Error"
    });
  });

  return app;
}
