# Backend structure (fits the frontend architecture 1:1)

The frontend already talks to an adapter interface (`packages/integration` → `MonitoringApi`) and a
reducer whose actions are `entity/verb`. The backend is the HTTP implementation of that contract in
the same monorepo, sharing the same domain types. One language end-to-end (TypeScript).

## Stack (default; swap only with a reason)
Node 22 + TypeScript · **Fastify** (or Hono) · **Prisma** + PostgreSQL · **zod** for every boundary ·
**BullMQ** + Redis for jobs (ingestion fan-out, IMAP poll, push, Telegram) · pino logging ·
vitest + supertest · Docker Compose for local infra (postgres, redis, mailpit).

## Where it lives
```
apps/
  api/                          # @scope/api — the backend service
    src/
      main.ts                   # boot: env → db → server → jobs
      app.ts                    # buildApp(): plugins, error handler, routes. No side effects (testable)
      env.ts                    # zod-validated process.env → typed Env (fail fast)
      plugins/                  # auth, cors, rate-limit, request-id, openapi
      modules/<feature>/        # ONE folder per domain feature (mirrors apps/*/pages/<feature>)
        <feature>.routes.ts     # HTTP only: parse (zod) → call service → map to response
        <feature>.service.ts    # business rules; the only place that knows the rules
        <feature>.repo.ts       # Prisma queries; returns domain types, never Prisma types outward
        <feature>.schemas.ts    # zod request/response schemas (imported by contracts)
        <feature>.test.ts
      ingestion/                # the blackbox, server side
        webhook.ts              # POST /webhooks/roomalert: verify HMAC, parse, enqueue
        imap-poller.ts          # job: poll mailbox → parseEmail → enqueue
        normalise.ts            # AlertEvent → (device, sensor, outlet) resolution
        alert-engine.ts         # open / clear / dedupe, KPI timestamps, emits domain events
      notify/                   # outbound channels behind ONE interface (Notifier)
        push.fcm.ts · telegram.bot.ts · email.ts
      jobs/                     # queue definitions + workers; every job idempotent, retry w/ backoff
      db/
        schema.prisma · migrations/ · seed.ts (reuses scripts/generate-fixtures.ts output)
      lib/                      # ids (newId prefix), time (tz-aware), errors (AppError → problem+json), pagination
    test/                       # e2e against a throwaway postgres (testcontainers) + contract tests
packages/
  contracts/                    # @scope/contracts — zod schemas + inferred types for every endpoint.
                                # Imported by apps/api (validate) AND packages/integration (HttpApi typing). Single source of truth.
  types/                        # unchanged: domain entities shared by DB mapping, API and UI
```
Dependency direction stays downward: `apps/api → contracts / integration(parsers) → types`. The API never imports from `apps/admin` or `packages/ui`.

## Layering rules (per module)
- **routes**: no logic. `schema` (zod) on body/params/query/response; `preHandler` auth; call one service method; return.
- **service**: pure business rules on domain types; receives `ctx` (`{ tenant, user, now, logger }`); throws `AppError(code, status)`; never touches `req`/`res`.
- **repo**: only Prisma; maps rows ↔ domain types (`toDomain()`); all queries **tenant-scoped** (`where: { distributorId: ctx.tenant }`) — the server-side twin of `useScoped()`.
- **events**: services emit domain events (`alert.triggered`, `alert.cleared`, `ticket.completed`) to an outbox table; workers fan out. Never call push/Telegram inline in a request.

## API contract = the reducer, spelled as REST
| Frontend action (`entity/verb`) | HTTP | Notes |
|---|---|---|
| `outlets/upsert` | `PUT /distributors/{id}/outlets/{outletId}` (create = `POST …/outlets`) | body = `OutletInput` |
| `outlets/remove` | `DELETE …/outlets/{outletId}` | cascade in a DB transaction, same rules as the reducer |
| `devices/add` | `POST …/devices` | returns device + generated sensors + port map |
| `sensors/upsert` | `PUT …/devices/{deviceId}/sensors/{sensorId}` | port uniqueness enforced by a DB unique index `(deviceId, portKind, portIndex)` |
| `alerts/respond` | `POST /alerts/{id}/respond` (multipart: notes + photos) | first responder wins (`WHERE response IS NULL` update, 409 otherwise) |
| `alerts/clear` | `POST /alerts/{id}/clear` | admin only |
| `tickets/create · assign · setStatus` | `POST /tickets`, `PATCH /tickets/{id}` | status transitions validated in service |
| `employees/approve · issueToken · revoke` | `POST /employees/{id}/{approve|token|revoke}` | |
| ingest | `POST /webhooks/roomalert`, `POST /webhooks/email` | HMAC `X-Signature` over raw body; 202 + `alertId` |
| reads | `GET /distributors/{id}/{outlets|devices|alerts|tickets|employees…}?cursor&limit&status&outletId` | cursor pagination, filters mirror the UI tabs |
| health | `GET /health` → `{ ok, version, db, queue }` | used by the Integration page |
Conventions: JSON, `camelCase`, ISO-8601 with offset, ids as prefixed strings, errors as `application/problem+json` `{ type, title, status, detail, code }`, list responses `{ items, nextCursor, total? }`. Every endpoint documented via the zod schemas → OpenAPI (`/docs`).

## Auth & tenancy (mirrors the two apps)
- **Admin**: email + password → short-lived JWT access (15 min) + rotating refresh cookie; claims `{ sub, distributorId, role }`. Roles: `admin`, `viewer`.
- **Mobile**: email + registration token (issued/rotated by admin, one active per person) → long-lived device token bound to a device id; `kind: employee | technician`; scope = their `outletIds` (technician = whole distributor).
- Every handler resolves `ctx.tenant` from the token, never from the URL alone; URL `distributorId` must equal the claim or 403.
- Magic-link style login (`?email&token`) is just the same token exchange over GET → keep it.

## Ingestion pipeline (the blackbox, server side)
`receive (webhook / IMAP) → verify → parse (`parsers.ts` from packages/integration, reused) → normalise (match device by MAC → serial → name; sensor by name → type → first) → alert-engine (open new / clear matching open / dedupe by externalAlertId) → persist → outbox event → workers: push to outlet employees, Telegram broadcast, KPI rollup`.
- Unknown device → 422 with a stored `unmatched_events` row the Integration page can list.
- Idempotency: `externalAlertId + event` unique; replays return the existing alert.
- Every inbound/outbound call writes a `request_log` row (direction, channel, path, status, ms, summary) — that is the Request log tab.

## Database conventions
- Prisma models mirror `packages/types` names and fields; enums are Prisma enums with the same values.
- Every table: `id` (prefixed string), `distributorId`, `createdAt`, `updatedAt`; soft delete only where the UI needs history (`deletedAt`).
- Readings/time-series in a narrow table `(sensorId, at, temperatureC, humidityPct)` partitioned monthly; keep 90 days hot.
- Migrations via `prisma migrate`; `seed.ts` loads the same seeded JSON the frontend fixtures use, so mock and real backends show identical demo data.

## Jobs & integrations
- Queues: `ingest`, `notify`, `poll`, `rollup`. Workers are idempotent, retry with exponential backoff, dead-letter after 5.
- `Notifier` interface `{ send(event, recipients) }` with `FcmNotifier`, `TelegramNotifier`, `EmailNotifier`, `NoopNotifier` (dev). Chosen by `IntegrationConfig` stored per distributor (same shape as the frontend config).
- IMAP poller: interval from config, marks mails seen, stores raw text for replay.
- Telegram: `/register <token>` binds a chat to an outlet contact; broadcast message format = the ANBot layout (status line, name, location, alert id, sensor block).

## Config, ops, quality
- `env.ts` zod schema: `DATABASE_URL, REDIS_URL, JWT_SECRET, WEBHOOK_SECRET, FCM_*, TELEGRAM_BOT_TOKEN, IMAP_*, PORT`. Missing var = crash at boot with a clear message.
- `docker-compose.yml` at repo root: postgres, redis, mailpit; `pnpm dev:api` runs migrations then the server.
- Logging: pino with `requestId`, `tenant`, `userId`; no PII in logs (mask tokens).
- Tests: unit (services with in-memory repos), route tests (supertest against `buildApp()`), contract tests that run the **same suite against `createMockApi` and `createHttpApi`** so both adapters stay in sync.
- CI gates: `pnpm typecheck`, `pnpm test`, `prisma validate`, build. Root scripts add `dev:api`, `test`, `db:migrate`, `db:seed`.

## Frontend migration when the backend lands
1. `packages/integration`: implement every `MonitoringApi` method in `createHttpApi` using `@scope/contracts` types; keep `createMockApi` for demos and tests.
2. Apps: introduce TanStack Query; each reducer action becomes a mutation hook (`useUpsertOutlet`) with optimistic update that applies the same reducer case locally, then invalidates the scoped query. `useScoped()` keeps its signature, now backed by queries — pages do not change.
3. `IntegrationConfig.mode = 'http'` toggles the adapter; the Integration page's health check and request log read from `/health` and `/request-log`.
4. Delete nothing from `packages/fixtures` until the seed script and contract tests depend only on `@scope/contracts`.

## Naming additions
| Thing | Convention | Example |
|---|---|---|
| module files | `<feature>.{routes,service,repo,schemas,test}.ts` | `tickets.service.ts` |
| route | plural nouns, tenant prefix for master data | `/distributors/{id}/devices` |
| domain event | `entity.pastTense` | `alert.cleared` |
| queue / job | `<queue>:<job>` | `notify:push` |
| env var | `UPPER_SNAKE` grouped by prefix | `IMAP_HOST` |
| error code | `UPPER_SNAKE` | `PORT_ALREADY_USED` |
