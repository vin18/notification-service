import { createServer } from "node:http";

import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics
} from "prom-client";

const registry = new Registry();
let metricsInitialized = false;

export function initializeMetrics(processRole: "api" | "worker") {
  if (metricsInitialized) {
    return;
  }

  registry.setDefaultLabels({
    service: "notification-service",
    process_role: processRole
  });

  collectDefaultMetrics({
    register: registry,
    prefix: "notification_service_"
  });

  metricsInitialized = true;
}

export const httpRequestsTotal = new Counter({
  name: "notification_service_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [registry]
});

export const httpRequestDurationMs = new Histogram({
  name: "notification_service_http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry]
});

export const notificationsAcceptedTotal = new Counter({
  name: "notification_service_notifications_accepted_total",
  help: "Total number of accepted notification requests",
  labelNames: ["tenant_id", "channel", "duplicate"],
  registers: [registry]
});

export const notificationDeliveryAttemptsTotal = new Counter({
  name: "notification_service_delivery_attempts_total",
  help: "Total number of notification delivery attempts",
  labelNames: ["provider", "outcome", "retryable"],
  registers: [registry]
});

export const notificationDeliveryDurationMs = new Histogram({
  name: "notification_service_delivery_duration_ms",
  help: "Duration of notification delivery attempts in milliseconds",
  labelNames: ["provider", "outcome"],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [registry]
});

export const notificationStatusTransitionsTotal = new Counter({
  name: "notification_service_status_transitions_total",
  help: "Total number of notification status transitions",
  labelNames: ["status"],
  registers: [registry]
});

export const notificationQueueJobsTotal = new Counter({
  name: "notification_service_queue_jobs_total",
  help: "Total number of notification queue jobs observed by the worker",
  labelNames: ["event"],
  registers: [registry]
});

export const notificationQueueInFlight = new Gauge({
  name: "notification_service_queue_jobs_in_flight",
  help: "Current number of notification jobs actively being processed",
  registers: [registry]
});

export function metricsMiddleware() {
  return function observeHttpMetrics(request: { method: string; route?: { path?: string }; path: string }, response: { statusCode: number; once: (event: string, listener: () => void) => void }, next: () => void) {
    const startedAt = performance.now();

    response.once("finish", () => {
      const route = request.route?.path ?? request.path ?? "unknown";
      const statusCode = String(response.statusCode);
      const durationMs = performance.now() - startedAt;

      httpRequestsTotal.inc({
        method: request.method,
        route,
        status_code: statusCode
      });

      httpRequestDurationMs.observe(
        {
          method: request.method,
          route,
          status_code: statusCode
        },
        durationMs
      );
    });

    next();
  };
}

export async function metricsResponse() {
  return registry.metrics();
}

export function metricsContentType() {
  return registry.contentType;
}

export function startMetricsServer(port: number, onListen?: () => void) {
  const server = createServer(async (_request, response) => {
    try {
      response.setHeader("Content-Type", metricsContentType());
      response.end(await metricsResponse());
    } catch (error) {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : "metrics error");
    }
  });

  server.listen(port, () => {
    onListen?.();
  });

  return server;
}
