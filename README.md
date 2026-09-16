# Monitoring System UI

Frontend-only monorepo for an outlet environment & security monitoring system (Room Alert IoT devices), modelled on the Indomaret RoomAlert proposal deck. WIT.ID visual language (WIT Red `#ED1C24`, ink `#101112`, DM Sans) in a smart-home dashboard style.

No backend yet: every screen reads static JSON fixtures from `packages/fixtures/data`, and session-only actions (respond to alert, approve registration, maintenance tickets, contact CRUD) live in an in-memory reducer.

## Apps

| App | Path | Dev URL | Demo login |
|---|---|---|---|
| Admin dashboard (distributor office) | `apps/admin` | http://localhost:5173 | `admin@indomaret.co.id` / token `admin123` |
| Employee mobile PWA | `apps/mobile` | http://localhost:5174 | employee `user123@indomaret.co.id` / `9634871231` · technician `tech@wit.id` / `2468013579` |

Master data has full create / edit / delete in the admin (session state): Outlet, Device Type, Device (plus its Sensors and port map), Employee, Contact Person, Technician, and Maintenance tickets.

Admin pages: Setup wizard (`/setup`, distribution center → outlets → units & sensors → employees → integration), API Integration (`/integration`, channel settings, blackbox console to replay webhook / e-mail payloads into the alert engine, request log, endpoint reference), Dashboard (Operations and Maintenance points of view, with a hardware-health strip in both), Outlet (with floor plan tab), Shopfloor (OpenStreetMap of all installation points + in-store floor plan with sensor markers), Contact Person, Device Type, Device Info (table or shopfloor view, add / edit / remove devices and sensors), Device Maintenance (hardware health, tickets, schedule, technicians), User Management, Alerts, Analysis, Report (CSV export). The sidebar rail expands to show labels.

Mobile screens: Login (employee or technician), Alerts (outlet filter, needs-response / responded / cleared), Alert detail with notes + photo proof response, Devices per outlet with floor plan, Maintenance (hardware health, tickets, report an issue; technicians start / complete tickets with notes and photos), Account with install banner.

## Packages

- `packages/types` – domain TypeScript types
- `packages/fixtures` – generated JSON data, typed accessors, formatting/KPI/maintenance helpers, session reducer
- `packages/integration` – the API blackbox: `MonitoringApi` adapter contract (mock + HTTP implementations), Room Alert webhook / e-mail parsers, integration config
- `packages/ui` – shared component kit (Radix + Tailwind v4, shadcn-style)
- `packages/tailwind-config` – WIT.ID theme tokens (`theme.css`)
- `packages/tsconfig` – shared TS configs

## Commands

```bash
pnpm install
pnpm dev:admin        # admin on :5173
pnpm dev:mobile       # mobile PWA on :5174
pnpm typecheck
pnpm build
pnpm preview:mobile   # serve the built PWA (service worker + manifest) on :4174
pnpm gen:fixtures     # regenerate packages/fixtures/data (seeded, deterministic)
```

All relative times ("Today, 13:24", "Ongoing for 6 minutes") are computed against the fixed fixture clock `2026-09-07 13:30 WIB`, so the demo never drifts.

## House style skill (`wit-ui-style`)

The UI style, clean code structure and backend design of this project are packaged as a Claude Code skill in `.claude/skills/wit-ui-style` (auto-loaded when working inside this repo). To install it globally on another machine:

```bash
git clone --depth 1 https://github.com/syabanf/device-monitoring-system.git /tmp/dms && mkdir -p ~/.claude/skills && cp -R /tmp/dms/.claude/skills/wit-ui-style ~/.claude/skills/ && rm -rf /tmp/dms
```

## Backend (`apps/api`, Go)

A separate service in the same monorepo: Go 1.26, chi, pgx on PostgreSQL, JWT auth, and a
sequence-backed outbox for fan-out. It owns the wire contract the two frontends read, so the
Integration page can move from the mock adapter to HTTP without a UI rewrite.

```
apps/api
  cmd/api                 boot: config, pool, migrations, router, graceful shutdown
  cmd/seed                loads the generated fixtures so mock and API show the same data
  internal/config         environment parsed once, refuses to boot when a value is missing
  internal/server         every route on one router, built without side effects for tests
  internal/auth           JWT claims, Ctx{tenant,userId,kind,outletIds}, tenant and admin guards
  internal/httpx          problem+json, JSON decode with unknown-field rejection, cursors
  internal/<feature>      handler (HTTP only) -> service (rules) -> repo (SQL, tenant-scoped)
  internal/ingest         webhook and e-mail parsing, device matching, alert engine
  internal/jobs           queue and outbox dispatcher; internal/notify hides the channels
  internal/store          pool plus an embedded migration runner
```

Run it locally:

```bash
pnpm infra:up                                  # postgres on 5442, redis on 6382, mailpit on 8025
cp apps/api/.env.example apps/api/.env         # fill DATABASE_URL, JWT_SECRET, WEBHOOK_SECRET
set -a && . apps/api/.env && set +a
pnpm --filter @monitoring/api db:migrate       # embedded migrations, applied once each
pnpm db:seed                                   # 30 outlets, 36 devices, 643 alerts, 81 tickets
pnpm dev:api                                   # http://localhost:3000
```

Master data CRUD is complete: outlets, device types, devices with nested sensors, employees
(plus approve, issue token, revoke), technicians (plus token rotation) and contact persons.
Alerts carry the full lifecycle with a first-responder claim, tickets follow their own status
flow, and `POST /webhooks/roomalert` and `/webhooks/email` ingest signed payloads.

| Area | Endpoints |
|---|---|
| System | `GET /health` |
| Distribution center | `GET,PUT /distributors/{id}` |
| Auth | `POST /auth/admin/login`, `POST /auth/token/login` |
| Outlets | `GET,POST /distributors/{id}/outlets`, `GET,PUT,DELETE …/outlets/{outletId}` |
| Device types | `GET,POST /device-types`, `GET,PUT,DELETE /device-types/{deviceTypeId}` |
| Devices | `GET,POST …/devices`, `GET,PUT,DELETE …/devices/{deviceId}`, `PUT,DELETE …/devices/{deviceId}/sensors/{sensorId}` |
| Employees | `GET,POST …/employees`, `GET,PUT,DELETE …/employees/{employeeId}`, `POST …/{approve,token,revoke}` |
| Technicians | `GET,POST …/technicians`, `GET,PUT,DELETE …/technicians/{technicianId}`, `POST …/token` |
| Contacts | `GET,POST …/contact-persons`, `GET,PUT,DELETE …/contact-persons/{contactId}` |
| Alerts | `GET …/alerts`, `GET /alerts/{alertId}`, `POST /alerts/{alertId}/respond`, `POST /alerts/{alertId}/status` |
| Tickets | `GET,POST …/tickets`, `PATCH …/tickets/{ticketId}` |
| Readings | `GET …/readings/latest`, `GET …/readings?sensorId&outletId&from&to&bucket=hour` |
| Stats | `GET …/stats?period=today\|7d\|30d\|all` |
| Integration | `GET,PUT …/integration`, `GET …/integration/request-log`, `GET …/integration/unmatched`, `POST …/integration/test/{channel}` |
| Photos | `POST /uploads` (multipart `file`), `GET /uploads/{name}` |
| Ingestion | `POST /webhooks/roomalert`, `POST /webhooks/email`, `POST /webhooks/readings` |

Conventions: JSON with camelCase keys, ISO-8601 timestamps, prefixed string ids, cursor
pagination as `{items, nextCursor}`, and `application/problem+json` for every non-2xx answer.
Admins sign in with a password; employees and technicians exchange the registration token their
admin issued. Every repo query filters by the tenant in the token, and a URL naming another
distribution center answers 403.

### Behaviour the frontend should rely on

**Outlet scoping.** An employee token narrows every list to the outlets that employee is
registered at: devices, tickets, contact persons, employees, alerts and readings. Admin and
technician tokens reach the whole distribution center. `auth.Ctx.OutletScope()` decides this once
and each repo applies it in SQL, so a new list inherits the rule by passing the scope through.

**Stats payload.** `GET /distributors/{id}/stats?period=today|7d|30d|all` answers with
`period`, `from`, `alertsByStatus`, `open`, `solved`, `total`, `avgResponseSec`, `responseRate`,
`perDay` (one bucket per day, split into `COMFORT` and `SECURITY`), `byOutlet` (average response
seconds and count per outlet), `devices` (total, online, offline), `tickets` (open, overdue, done)
and `pendingAccounts`. That covers what `packages/fixtures/src/kpi.ts` computes in the browser
today, so the dashboard and analysis pages can stop loading every alert. The summary respects
outlet scoping, so an employee sees their own numbers.

**Photo upload.** `POST /uploads` takes one multipart field named `file` and answers
`{url, contentType, bytes}`. The url is a path such as `/uploads/pho-m1abc123.jpg`, which is what
an alert response and a finished ticket store in `photoUrls`. Both reject a list that points
anywhere else, so a saved record cannot embed a link to another host. Uploads are capped at 5 MB
and six photos per record, and the type comes from sniffing the bytes rather than from the
browser. `GET /uploads/{name}` needs no token because an `<img>` tag cannot send one; the random
file name is what keeps a photo private. The disk driver writes to `UPLOAD_DIR`, and
`uploads.Store` is the seam where a deployment swaps in object storage.

**Integration secrets.** Settings live in `integration_config`, one row per distribution center,
rather than in a single browser's localStorage. The Telegram bot token is write-only: a read
returns an empty string plus `telegramTokenSet: true`, and saving an empty token keeps the stored
one while applying the other edits. `POST …/integration/test/{channel}` reports what a channel can
do today, so `roomalert` answers `ok: true` with its recent call count while `telegram` and `push`
answer `ok: false` and name the missing client.

### Tests

`apps/api/internal` holds table-driven unit tests for the rules that need no database: the alert
and ticket lifecycles, outlet scoping, password hashing, the period window and the two payload
parsers. `apps/api/test` drives the whole HTTP surface against a real PostgreSQL through
`httptest`, which is the only place the repo queries, cursors and scope clauses run.

```bash
pnpm infra:up
cd apps/api
DATABASE_URL=postgres://monitoring:monitoring@localhost:5442/monitoring?sslmode=disable go test ./...
```

The suite skips itself when `DATABASE_URL` is unset, so `go test ./...` stays useful without
Docker. It owns the schema it runs against: `reset(t)` truncates every table and rebuilds a small
deterministic world (two distribution centers, three outlets, two devices, one employee covering
two of the three outlets), so tests never depend on each other's order. Point it at a throwaway
database.

### Container and CI

`apps/api/Dockerfile` builds a static binary in `golang:1.26-alpine` and copies it onto
distroless, so the image carries no shell and runs as `nonroot`. The build context is `apps/api`,
which keeps the frontend workspaces out of it.

```bash
docker build -t monitoring-api apps/api
docker run -p 3000:3000 -e DATABASE_URL=… -e JWT_SECRET=… -e WEBHOOK_SECRET=… monitoring-api
```

`.github/workflows/ci.yml` runs three jobs on every push and pull request: the frontend
workspaces through `turbo typecheck` and `turbo build`, the API through `gofmt -l`, `go vet` and
`go test` against a PostgreSQL service container, and a Docker build of the API image.

Still open: push through FCM with a device-token endpoint, the Telegram bot and its `/register` flow, the IMAP poller, a scheduled job
that marks a device offline when its push status stops, a Redis-backed queue in place of the
inline dispatcher, refresh tokens, and an OpenAPI document at `/docs`.
