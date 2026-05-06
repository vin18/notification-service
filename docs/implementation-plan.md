# 7-Day Implementation Plan

## Project Objective

Ship a live Node.js notification service in 7 days with a deliberately small phase-1 feature set and clear system design concepts.

This project should feel like a real system, not just an email sender. The design should show good engineering judgment:

- keep the first version small
- decouple request intake from delivery
- make duplicate sends unlikely
- handle retries safely
- leave a credible path to future scale

## Final Phase 1 Deliverable

At the end of day 7, the system should support:

- create notification requests through an HTTP API
- deliver email asynchronously
- schedule notifications for a future time
- prevent duplicates with idempotency keys
- respect user email preferences
- retry failed deliveries with backoff
- track current status and delivery attempts
- expose health and basic observability
- run as a live deployed app

## Scope Boundaries

Do in phase 1:

- `email` only
- one provider only
- one queue only
- one API service and one worker process
- simple preference model: enabled or disabled
- simple status model

Do not do in phase 1:

- SMS
- push notifications
- multi-region deployment
- Kafka
- complex templating UI
- advanced analytics
- provider failover across multiple vendors

## Recommended Tech Choices

- Runtime: `Node.js`
- Language: `TypeScript`
- Web framework: `Express.js`
- Database: `PostgreSQL`
- Queue: `BullMQ` on `Redis`
- ORM: `Prisma`
- Logging: `pino`
- Local infra: `Docker Compose`
- Deployment: `Render`, `Railway`, or `Fly.io`

Why these choices:

- `Express.js` is quick to scaffold and production-friendly
- `BullMQ` gives you retries, delayed jobs, and workers fast
- `Postgres` gives you strong persistence and great developer speed
- `Redis` is enough for a clean queue-backed MVP
- this stack is realistic for a fast portfolio launch

## Core APIs

### `POST /notifications`

Creates a new notification request.

Request body:

```json
{
  "tenantId": "t1",
  "userId": "u1",
  "channel": "email",
  "subject": "Welcome",
  "body": "Hello from NotifyX",
  "scheduledAt": "2026-04-29T18:30:00Z",
  "idempotencyKey": "welcome-u1-001"
}
```

Behavior:

- validate input
- check idempotency
- persist notification row
- enqueue job for immediate or delayed processing
- return `202 Accepted`

### `GET /notifications/:id`

Returns:

- current status
- timestamps
- failure reason if any
- provider message ID if available

### `GET /users/:id/preferences`

Fetches user delivery preferences.

### `PUT /users/:id/preferences`

Enables or disables the `email` channel.

### `GET /health`

Health endpoint for deployment and uptime checks.

### `GET /metrics`

Optional metrics endpoint if Prometheus is added.

## Data Model

### `users`

- `id`
- `email`
- `tenant_id`
- `created_at`

### `user_preferences`

- `id`
- `user_id`
- `channel`
- `enabled`

### `notifications`

- `id`
- `tenant_id`
- `user_id`
- `channel`
- `subject`
- `body`
- `status`
- `scheduled_at`
- `sent_at`
- `failure_reason`
- `provider_message_id`
- `idempotency_key`
- `created_at`
- `updated_at`

### `delivery_attempts`

- `id`
- `notification_id`
- `attempt_number`
- `provider`
- `status`
- `error_message`
- `started_at`
- `finished_at`

## Status Model

Use a small but meaningful set of states:

- `PENDING`
- `PROCESSING`
- `SENT`
- `FAILED`
- `RETRYING`
- `SKIPPED`

`SKIPPED` is useful for preference-disabled sends and makes the project feel more correct.

## Delivery Flow

1. API receives create request
2. API validates body and idempotency key
3. API inserts notification row with `PENDING`
4. API enqueues BullMQ job
5. Worker receives job and loads notification
6. Worker checks user preference
7. Worker updates status to `PROCESSING`
8. Worker sends email through provider adapter
9. Worker records a delivery attempt
10. Worker updates notification to `SENT` or schedules retry
11. If retries are exhausted, worker marks notification `FAILED`

## Reliability Rules

### Idempotency

Use a unique database constraint on:

- `tenant_id`
- `idempotency_key`

If the same request comes twice, return the existing notification instead of creating another one.

### Retries

Use BullMQ retry support with exponential backoff:

- max attempts: `3` or `5`
- retry only on transient provider failures
- mark permanent validation errors as non-retryable

### At-least-once Processing

The worker may process a job more than once in some failure scenarios. To handle this cleanly:

- update status carefully
- avoid duplicate sends when possible
- store provider message ID
- ensure handlers are safe to rerun

### Scheduling

If `scheduledAt` is in the future:

- enqueue the BullMQ job with delay

If it is absent:

- enqueue immediately

### Rate Limiting

In phase 1, add simple Redis-backed rate limiting:

- per IP for public API safety
- optionally per tenant for better storytelling

## 7-Day Execution Plan

## Day 1: Setup and Foundation

Goal:
Create the repo structure and boot the local stack.

Tasks:

- create `TypeScript` Node.js project
- scaffold `Fastify` server
- configure `Prisma`
- set up `Postgres` and `Redis` with `Docker Compose`
- add `pino` logger
- add env validation with `zod`
- create `GET /health`
- document setup steps in README

Deliverable:

- app runs locally
- database connects
- Redis connects
- first migration works

Success criteria:

- `docker compose up` starts infra
- API server boots without errors
- health check returns `200`

## Day 2: Notification Intake API

Goal:
Implement the create-notification flow.

Tasks:

- define request schema for `POST /notifications`
- create `notifications` table
- implement idempotency-key handling
- persist notification as `PENDING`
- enqueue BullMQ job using notification ID
- implement `GET /notifications/:id`

Deliverable:

- notifications can be created
- duplicate idempotent requests return the same record
- queued jobs are visible in Redis/BullMQ

Success criteria:

- API returns `202`
- duplicate requests do not create duplicate rows
- created notifications can be fetched by ID

## Day 3: Worker and Provider Integration

Goal:
Make notifications actually send.

Tasks:

- create worker process
- create provider abstraction
- integrate one email provider
- implement delivery-attempt recording
- update status transitions in DB
- store provider message ID when available

Deliverable:

- notification flows from `PENDING` to `SENT`
- failed sends record an attempt

Success criteria:

- one test notification can be sent end-to-end
- DB shows attempt history
- logs clearly trace the delivery

## Day 4: Scheduling, Preferences, and Retries

Goal:
Add production-aware delivery behavior.

Tasks:

- support delayed jobs via BullMQ
- add `user_preferences` table
- check preferences before sending
- add retry configuration with backoff
- distinguish retryable and non-retryable failures
- introduce `SKIPPED` for disabled preferences

Deliverable:

- scheduled notifications send later
- disabled users are not emailed
- failed transient sends retry automatically

Success criteria:

- future-dated notification is delayed correctly
- preference-disabled notification becomes `SKIPPED`
- retry behavior is visible in attempts and logs

## Day 5: Reliability and Operational Polish

Goal:
Show stronger system design signals.

Tasks:

- add request correlation IDs
- add API rate limiting
- add structured logs with `notificationId`, `tenantId`, `jobId`, `attempt`
- add dead-letter handling through BullMQ failure inspection
- add simple admin endpoint or query for failed notifications
- add useful database indexes

Deliverable:

- system is easier to debug and safer to expose publicly

Success criteria:

- one notification can be traced end-to-end in logs
- API blocks abusive traffic
- failed jobs are discoverable for debugging

## Day 6: Testing, Deployment, and Load Validation

Goal:
Ship the app live and prove the design works under load.

Tasks:

- add unit tests for service logic
- add one integration test for create-to-send flow
- run a simple load test with `k6` or `autocannon`
- deploy API and worker
- configure production env vars
- confirm health endpoint and live flow

Deliverable:

- live public API
- live worker
- basic performance results

Success criteria:

- deployed service is reachable
- a production test notification succeeds
- simple burst traffic does not break the API

## Day 7: Portfolio Packaging

Goal:
Turn the project into a strong shortlist asset.

Tasks:

- improve README
- add architecture diagram
- add sequence diagram
- write tradeoffs and scaling path
- include sample API requests
- include load test results
- record a short demo video or GIF

Deliverable:

- polished public repo
- easy-to-understand architecture story

Success criteria:

- reviewer understands the project in 3 minutes
- README clearly explains design choices
- project feels complete and intentional

## Suggested Future Code Layout

```txt
src/
  api/
    routes/
    plugins/
  worker/
    jobs/
  modules/
    notifications/
    users/
    preferences/
  infra/
    db/
    queue/
    providers/
    logger/
    config/
  types/
```

## Interview Positioning

When presenting the project, emphasize:

- modular monolith for fast execution
- queue-backed async delivery to decouple ingestion from sending
- idempotency to avoid duplicate notifications
- retries with backoff for transient failures
- preference-aware delivery rules
- auditability with delivery attempts
- clean migration path from BullMQ to Kafka or SQS

## Phase 2 Scaling Path

Once phase 1 is live, the most credible next steps are:

- add SMS and push channels
- add templates
- add provider webhooks
- add tenant quotas
- implement outbox pattern
- add dead-letter dashboards
- move queueing to Kafka or SQS
- split workers by channel

## Practical Advice

The strongest version of this project is one that is:

- live
- understandable
- operationally solid
- intentionally scoped

Finishing a small but real system is much better than partially building a huge one.
