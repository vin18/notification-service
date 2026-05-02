import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { pgPool } from "./lib/postgres.js";
import { redis } from "./lib/redis.js";

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, "API server started");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");

  server.close(async (serverError) => {
    if (serverError) {
      logger.error({ err: serverError }, "Error while closing HTTP server");
      process.exit(1);
    }

    try {
      await Promise.all([
        pgPool.end(),
        redis.quit()
      ]);

      logger.info("Shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Error while closing dependencies");
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
