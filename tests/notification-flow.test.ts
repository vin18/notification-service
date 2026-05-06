import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { createApp } from "../src/app.js";
import { startHttpServer } from "../src/lib/http-server.js";
import { getNotificationById } from "../src/modules/notifications/notifications.service.js";
import { startWorker, shutdownWorker } from "../src/worker-app.js";

test("notification create flow reaches SENT with recorded delivery attempt", async () => {
  const app = createApp();
  const server = startHttpServer(app, 0);
  const workerRuntime = startWorker({ metricsPort: 0 });

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  const notificationId = `test-${Date.now()}`;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await fetch(`http://127.0.0.1:${address.port}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": notificationId
    },
    body: JSON.stringify({
      tenantId: "test-tenant",
      userId: `user-${Date.now()}`,
      userEmail: `integration-${uniqueSuffix}@example.com`,
      channel: "EMAIL",
      subject: "Integration",
      body: "<p>Integration flow</p>",
      idempotencyKey: notificationId
    })
  });

  assert.equal(response.status, 202);
  const payload = await response.json() as {
    data: {
      id: string;
      status: string;
    };
  };

  assert.equal(payload.data.status, "PENDING");

  let finalStatus = payload.data.status;
  for (let index = 0; index < 25; index += 1) {
    await delay(200);
    const notification = await getNotificationById(payload.data.id);

    if (notification?.status === "SENT") {
      finalStatus = notification.status;
      assert.equal(notification.attempts.length, 1);
      assert.equal(notification.attempts[0]?.status, "SUCCESS");
      assert.ok(notification.providerMessageId);
      break;
    }
  }

  assert.equal(finalStatus, "SENT");

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }),
    shutdownWorker(workerRuntime)
  ]);
});
