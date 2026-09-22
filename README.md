# Monitoring System

Monorepo for an outlet environment & security monitoring system (Room Alert IoT devices), modelled
on the Indomaret RoomAlert proposal deck, in the Indomaret palette sampled from the client's
logo: blue `#006AB3` for the dark surfaces, red `#D61D25` as the single accent, yellow `#FFCF20`
for the brand stripe, set in DM Sans with the smart-home dashboard layout. The tokens live in
`packages/tailwind-config/theme.css`, and `BRAND` in `packages/ui` mirrors them for charts, map
markers and SVG. `BrandMark` draws the supplied logo (`packages/ui/src/assets/indomaret-logo.webp`),
on a white plate wherever it sits on blue.

Both frontends run against the Go API in `apps/api`. They sign in with a real token, load the
distribution center from the API, and write every change back to it: master data, the alert
lifecycle, maintenance tickets, photo uploads and the integration settings. The generated JSON in
`packages/fixtures/data` is now the seed the API loads, not what the browser reads.

## Apps

| App | Path | Dev URL | Demo login |
|---|---|---|---|
| Admin dashboard (distributor office) | `apps/admin` | http://localhost:5173 | `admin@indomaret.co.id` / password `admin123` |
| Employee mobile PWA | `apps/mobile` | http://localhost:5174 | employee `user123@indomaret.co.id` / `9634871231` · technician `tech@wit.id` / `2468013579` |

Master data has full create / edit / delete in the admin, each one a call to the API: Outlet,
Device Type, Device (plus its Sensors and port map), Employee, Contact Person, Technician, and
Maintenance tickets.

Every installed point shows its own dials: a temperature dial with the band drawn on the scale,
a humidity column with the same, and a state dial for door, motion, power and panic sensors. The
admin shows them per device and on the shopfloor marker; the phone opens them in a bottom sheet
when an employee taps a point.

Admin pages: Setup wizard (`/setup`, distribution center → outlets → units & sensors → employees → integration), API Integration (`/integration`, channel settings, blackbox console to replay webhook / e-mail payloads into the alert engine, request log, endpoint reference), Dashboard (Operations and Maintenance points of view, with a hardware-health strip in both), Outlet (with floor plan tab), Shopfloor (OpenStreetMap of all installation points + in-store floor plan with sensor markers), Contact Person, Device Type, Device Info (table or shopfloor view, add / edit / remove devices and sensors), Device Maintenance (hardware health, tickets, schedule, technicians), User Management, Alerts, Analysis, Report (CSV export). The sidebar rail expands to show labels.

Mobile screens: Login (employee or technician), Alerts (outlet filter, needs-response / responded / cleared), Alert detail with notes + photo proof response, Devices per outlet with floor plan, Maintenance (hardware health, tickets, report an issue; technicians start / complete tickets with notes and photos), Account with install banner.

## Packages

- `packages/types` – domain TypeScript types
- `packages/api-client` – the typed HTTP client both apps use: problem+json errors, cursor paging, photo upload, and `loadSnapshot` for the whole tenant
- `packages/fixtures` – generated JSON seed data, formatting/KPI/maintenance helpers, and the reducer that holds the loaded tenant
- `packages/integration` – Room Alert webhook / e-mail parsers and the endpoint reference the Integration page lists
- `packages/ui` – shared component kit (Radix + Tailwind v4, shadcn-style)
- `packages/tailwind-config` – Indomaret theme tokens (`theme.css`)
- `packages/tsconfig` – shared TS configs

## Commands

```bash
pnpm install
pnpm stack:up         # everything in containers: admin :8080, mobile :8081, API :3300
pnpm stack:seed       # load the demo data into the containerised database
pnpm stack:down

pnpm infra:up         # or run the apps from source: postgres :5442, redis :6382, mailpit :8025
pnpm db:migrate       # apply the embedded migrations, including the three admin accounts
pnpm db:seed          # optional: load the full demo data, shifted so the newest row lands now
pnpm dev:api          # API on :3000
pnpm dev:admin        # admin on :5173
pnpm dev:mobile       # mobile PWA on :5174
pnpm typecheck
pnpm build
pnpm preview:mobile   # serve the built PWA (service worker + manifest) on :4174
pnpm gen:fixtures     # regenerate packages/fixtures/data (seeded, deterministic)
```

Both apps read `VITE_API_URL` (see `apps/*/.env.example`) and fall back to `http://localhost:3000`.
The seeder shifts every fixture timestamp by the same delta so the newest alert lands at the
current time, and the apps read their clock from the wall: "Today, 13:24" means today.

### How a page reaches the API

`AppStateProvider` loads the whole distribution center in one round of parallel calls and keeps it
in the reducer from `@monitoring/fixtures`. Pages read that state exactly as before. A write still
dispatches the action it always did; `state/commands.ts` maps that action onto the call behind it
and applies the row the server answered with, so the ids, tokens and ticket numbers on screen are
the ones in the database. A failed write leaves the state alone and shows the API's message.

The API scopes every list to the token, so the mobile app receives only the outlets its employee
is registered at without asking for them.

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
| Sensors | `GET …/sensors?outletId&deviceId` (every sensor in one call, for the floor plans) |
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

### Containers

`docker-compose.yml` runs the whole system: PostgreSQL, Redis, Mailpit, the API, the admin
dashboard and the mobile PWA.

```bash
docker compose up -d --build     # or: pnpm stack:up
docker compose run --rm seed     # or: pnpm stack:seed   (load the demo data once)
```

| Service | URL | Image |
|---|---|---|
| Admin dashboard | http://localhost:8080 | nginx on the built SPA, 79 MB |
| Mobile PWA | http://localhost:8081 | nginx on the built PWA, 78 MB |
| API | http://localhost:3300 | distroless static binary, 22 MB |
| Mailpit | http://localhost:8025 | |

The API image builds in `golang:1.26-alpine` and runs on distroless as `nonroot`, with no shell
inside; its health check calls `api -health`, which asks the running server for `/health`. A second
stage carries the seeder and the generated fixtures, which is the `seed` service. Photos live in
the `monitoring-uploads` volume.

The two frontend images build the workspace with pnpm and serve the output with nginx: SPA
fallback, immutable caching for the fingerprinted assets, and no caching for `/env.js`. That file
is how one image serves any environment: the container writes `window.__API_URL__` from `API_URL`
at startup, so the browser learns where the API is without a rebuild.

Host ports come from environment variables, so a busy port never blocks the stack:
`API_PORT` (3300 by default, since `pnpm dev:api` uses 3000) and `API_URL`, which is what the
browser calls and therefore a host address rather than the compose network name.

### CI

`.github/workflows/ci.yml` runs on every push and pull request: the frontend workspaces through
`turbo typecheck` and `turbo build`, the API through `gofmt -l`, `go vet` and `go test` against a
PostgreSQL service container, and a Docker build of all four images.

**Sessions.** A sign-in returns one access token, and nothing renews it: at `ACCESS_TOKEN_TTL`
(8 hours by default, 30 days for a phone) the client drops the session and the app returns to the
login screen. Refresh tokens are still open.

**First sign-in.** Two migrations give an empty database accounts to sign in with before anyone
runs the demo seeder. `0003_seed_admin.sql` creates the three distribution centers and one admin
each (`admin@indomaret.co.id`, `admin.jkt@indomaret.co.id`, `admin.dps@indomaret.co.id`), all with
the password `admin123`. `0004_seed_mobile_users.sql` adds one approved outlet employee and one
technician per distribution center for the mobile app, plus the outlets those employees work at:

| Distribution center | Employee (email / token) | Technician (email / token) |
|---|---|---|
| Surabaya | `user123@indomaret.co.id` / `9634871231` | `tech@wit.id` / `2468013579` |
| Jakarta Utara | `dewi.kusuma101@indomaret.co.id` / `5519965858` | `eko.purnama@wit.id` / `6893220859` |
| Denpasar | `dian.gunawan136@indomaret.co.id` / `3553120696` | `intan.pratama@wit.id` / `4589475365` |

Every one of these credentials sits in this repository: change the admin passwords and issue new
mobile tokens in User Management before the install faces real users. Both migrations skip rows
that already exist, and the ids match the fixtures, so `pnpm db:seed` loads over them cleanly.

**Rollout scope.** This deployment installs temperature and temperature-humidity sensors only.
The pickers grey out door, motion, power and panic, and the API refuses a create or a type change
naming one. Sensors installed before the scope narrowed keep reporting and stay editable, so an
admin can still rename one or move it on the floor plan. `ENABLED_SENSOR_TYPES` in
`packages/types` and `domain.EnabledSensorTypes` in the API are the two places to widen it.

**Sensor limits.** Every sensor carries its own band: a lower and an upper limit for temperature
and for humidity, edited in the sensor dialog and stored with the sensor. The API judges each
pushed reading against that band. A sample outside it opens one alert naming the limit that was
crossed ("Temperature above the 28.0 °C limit"), a later sample back inside resolves that alert,
and a sensor never holds more than one open alert, so a unit pushing every five minutes cannot
flood an outlet. Saving a band where a lower limit sits above its upper one answers 400.

**Alert lifecycle.** An employee who acknowledges an alert or starts an inspection takes
responsibility for it, and the alert records them as the assignee. Another employee at the same
outlet is then refused, which is the no-double-response rule from the deck. Saving the field
report resolves the alert; an admin verifies it afterwards.

Still open: push through FCM with a device-token endpoint, the Telegram bot and its `/register` flow, the IMAP poller, a scheduled job
that marks a device offline when its push status stops, a Redis-backed queue in place of the
inline dispatcher, refresh tokens, and an OpenAPI document at `/docs`.
