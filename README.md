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

## Backend (`apps/api`)

A separate service inside the same monorepo, TypeScript end to end: Fastify, Prisma on PostgreSQL,
zod at every boundary, BullMQ for fan-out, vitest for tests. It implements the contract the
frontend adapter already talks to, so switching the Integration page from `mock` to `http` is a
toggle rather than a rewrite.

```
apps/api/src
  env.ts                  zod-validated environment, crashes at boot with the missing keys listed
  app.ts                  buildApp(): plugins, problem+json error handler, routes. No side effects
  main.ts                 boot: env → db → queue → server → graceful shutdown
  plugins/auth.ts         JWT verify, Ctx { tenant, userId, kind, outletIds }, tenant and admin guards
  modules/<feature>/      routes (HTTP only) → service (rules) → repo (Prisma, always tenant-scoped)
  ingestion/              webhook + email → parse → normalise → alert engine → outbox
  jobs/                   queue (BullMQ, or inline without Redis), outbox dispatcher
  notify/                 one Notifier interface for push, Telegram and email
  db/                     schema.prisma, row → domain mappers, seed from the frontend fixtures
packages/contracts        zod schemas shared by the API and the frontend HttpApi
```

Run it locally:

```bash
pnpm infra:up                                   # postgres, redis, mailpit
cp apps/api/.env.example apps/api/.env          # fill DATABASE_URL, JWT_SECRET, WEBHOOK_SECRET
pnpm --filter @monitoring/api db:push           # create the schema
pnpm db:seed                                    # load the same demo data the frontend ships
pnpm dev:api                                    # http://localhost:3000, OpenAPI at /docs
```

Endpoints follow the reducer actions: `GET/POST/PUT/DELETE /distributors/:id/outlets`, `/devices`
(with nested `/sensors/:sensorId`), `/alerts` plus `/alerts/:id/respond` and `/status`, `/tickets`,
`POST /webhooks/roomalert` and `/webhooks/email`, and `GET /health`. Admins sign in at
`/auth/admin/login`; employees and technicians exchange their registration token at
`/auth/token/login`. Every response that is not 2xx is `application/problem+json`.

Employees, technicians and contact persons still read from fixtures in the UI; copy the outlets
module to add them. Without `REDIS_URL` the queue runs handlers inline, which keeps local
development to a single process.
