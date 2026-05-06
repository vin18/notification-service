import { createServer } from "node:http";

import type { Express } from "express";

export function startHttpServer(app: Express, port: number, onListen?: () => void) {
  const server = createServer(app);

  server.listen(port, () => {
    onListen?.();
  });

  return server;
}
