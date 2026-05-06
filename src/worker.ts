import { logger } from "./lib/logger.js";
import { startWorker, shutdownWorker } from "./worker-app.js";

const workerRuntime = startWorker();

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker gracefully");

  try {
    await shutdownWorker(workerRuntime);

    logger.info("Worker shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Worker shutdown failed");
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
