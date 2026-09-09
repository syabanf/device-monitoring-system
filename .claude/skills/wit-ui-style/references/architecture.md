# Clean code structure (monorepo + app layering)

Mirror this layout for any dashboard / mobile product in the house style. The point is a thin
UI on top of typed domain data, with every concern in exactly one place.

## Workspace layout (pnpm + Turborepo)
```
<repo>/
  package.json            # scripts: dev, dev:<app>, build, typecheck, format, gen:fixtures
  pnpm-workspace.yaml     # packages: apps/*, packages/*
  turbo.json              # build (dependsOn ^build, outputs dist/**), dev (persistent), typecheck (dependsOn ^typecheck)
  .prettierrc             # + prettier-plugin-tailwindcss (class order)
  scripts/                # one-off node/tsx scripts (e.g. generate-fixtures.ts, seeded, deterministic)
  apps/
    admin/                # desktop dashboard (Vite + React + TS)
    mobile/               # PWA (same stack + vite-plugin-pwa)
  packages/
    types/                # @scope/types   — domain model only (enums.ts, entities.ts). Zero deps.
    fixtures/             # @scope/fixtures — data layer: seeded JSON in data/, accessors, format, kpi, csv, store (reducer)
    integration/          # @scope/integration — API "blackbox": adapter contract, mock + http impls, parsers, config
    ui/                   # @scope/ui       — component kit (components/*.tsx, lib/cn.ts, barrel index.ts)
    tailwind-config/      # theme.css (tokens) shared by every app
    tsconfig/             # base.json, library.json, vite-react.json
```
Dependency direction is strictly downward: `apps → ui / fixtures / integration → types`. `ui` never imports domain data; `types` imports nothing. Packages export source (`"exports": { ".": "./src/index.ts" }`), no build step; apps bundle them.

## App layering (`apps/<app>/src`)
```
main.tsx          # providers only, in order: AppState → Auth → Api → Tooltip → Router
router.tsx        # createBrowserRouter; RequireAuth wraps the layout; one entry per page
index.css         # @import tailwindcss; @import '@scope/tailwind-config/theme.css'; @source '../../../packages/ui/src'
auth/auth.tsx     # AuthProvider + useAuth + RequireAuth; session persisted in localStorage under a namespaced key
state/
  app-state.tsx   # AppStateProvider(useReducer) + useAppState + useScoped()/useMobileScope() derived views
  api.tsx         # ApiProvider: adapter instance, config, request log, ingest mapping
  lookups.ts      # live id→entity maps refreshed from the store (never static fixture maps in UI)
layouts/          # <App>Layout.tsx (shell), SidebarNav.tsx, nav-items.ts (single NAV source + pageTitle())
pages/<feature>/  # one folder per route family: FeaturePage.tsx, FeatureDetailPage.tsx, feature-local dialogs/sheets
components/       # cross-page pieces: badges.tsx, AlertListItem.tsx, use*.tsx hooks, master/<Entity>Dialog.tsx + ConfirmDelete.tsx
lib/              # pure helpers/factories (device-factory.ts) — no React
```
Rules
- A page composes; it does not own business rules. Derivations live in `useScoped`, `packages/fixtures` (kpi.ts, maintenance.ts) or `lib/`.
- One dialog per master entity (`<Entity>Dialog` with `entity | null` prop: null = closed, `id === ''` = create) + a shared `ConfirmDelete`. Pages only hold `editing` / `removing` state.
- Feature-local components stay in the feature folder; promote to `components/` only on the second use; promote to `packages/ui` only when it has no domain imports.
- Hooks are `useX` files next to what uses them (`useFloorMarkers.tsx`, `useInfiniteList.tsx`); pure functions get `.ts`, JSX gets `.tsx`.

## Data & state conventions
- **Domain types first**: every entity in `packages/types/entities.ts`, unions/labels in `enums.ts` (`STATUS_LABEL` maps live beside the union). IDs are prefixed strings (`out-…`, `dev-…`, `sen-…`); alerts may be numeric ids from the source system.
- **Fixtures are generated, not hand-edited**: `scripts/generate-fixtures.ts` is seeded (deterministic) and writes JSON to `packages/fixtures/data/`; a fixed `FIXTURE_NOW` anchors all relative time.
- **Single reducer store** in `packages/fixtures/src/store.ts`: `AppState` holds every editable collection; `AppAction` is a discriminated union named `entity/verb` (`alerts/respond`, `devices/upsert`, `tickets/setStatus`); cascades (delete outlet → devices, sensors, tickets) are handled inside the reducer; a generic `upsert<T extends {id}>()` helper; `newId(prefix)`, `generateToken()`.
- **Scoped views, not global selectors**: `useScoped()` (admin) / `useMobileScope(outletIds)` (mobile) return memoised, tenant-filtered lists plus `byId` / `byParent` Maps and `dispatch`. Pages never filter the raw store themselves.
- **Live lookups** (`state/lookups.ts`) expose `.get(id)` maps refreshed on every reducer state, so renamed entities propagate to every list.
- **Integration blackbox**: `MonitoringApi` interface in `packages/integration/adapter.ts`; `createMockApi(readers)` serves the store, `createHttpApi(config)` calls the backend; parsers normalise inbound payloads into one `AlertEvent`; `IntegrationConfig` persisted in localStorage with `loadConfig()/saveConfig()`. UI only imports the interface.
- Persisted UI preferences (sidebar expanded, read alerts, session) use namespaced localStorage keys `ms.<app>.<thing>` wrapped in try/catch.

## Component & styling conventions
- UI kit components: forwardRef, `cva` variants + `cn()` merge, `asChild` via Radix `Slot`, `[&_svg]:size-4` for icon sizing, `data-[state=…]` / `data-[active=…]` for state styling. Files kebab-case (`dropdown-menu.tsx`); exported names PascalCase; one barrel `index.ts`.
- App components PascalCase files; pages end with `Page`, drawers with `Drawer`/`Sheet`, modals with `Dialog`, badges/helpers grouped in `badges.tsx`.
- Tailwind only (no CSS modules); semantic tokens from `theme.css` (`bg-card`, `text-muted`, `bg-accent`); arbitrary values only for the fixed radii/sizes in the style guide; class order formatted by prettier-plugin-tailwindcss.
- Icons: lucide-react only, imported by name; a domain `SensorIcon`/`XIcon` switch component maps enum → icon.
- Formatting/number helpers live in `packages/fixtures/format.ts` (`fmtAgo`, `fmtDate`, `fmtIdr`), never inline `toLocaleString` in JSX.

## TypeScript & quality gates
- `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `isolatedModules`; `import type` for types.
- Every package has `typecheck` (`tsc --noEmit`); root `pnpm typecheck` and `pnpm build` must pass before finishing.
- No `any`; narrow with discriminated unions; prefer `Record<Enum, string>` label maps over switch statements for display text.
- Effects only for subscriptions/observers; derived data via `useMemo` on store slices; never copy store state into local state (use it directly, key resets on explicit keys).

## Naming cheat sheet
| Thing | Convention | Example |
|---|---|---|
| package | `@scope/<name>` | `@monitoring/ui` |
| page | `<Feature>Page`, `<Feature>DetailPage` | `DevicesPage`, `DeviceDetailPage` |
| entity dialog | `<Entity>Dialog` + `empty<Entity>()` factory | `OutletDialog`, `emptyOutlet()` |
| reducer action | `entity/verb` | `tickets/assign` |
| scoped hook | `useScoped`, `useMobileScope`, `use<Thing>` | `useFloorMarkers` |
| label map | `<ENUM>_LABEL` | `TICKET_STATUS_LABEL` |
| storage key | `ms.<app>.<thing>` | `ms.admin.sidebar` |
| id | `<prefix>-<random>` | `dev-m1x9k2` |

## Starting a new project with this structure
1. Scaffold the workspace tree above; copy `tokens.css` into `packages/tailwind-config/theme.css`.
2. Write `packages/types` first; then a seeded generator and the reducer with `entity/verb` actions.
3. Build `packages/ui` from `components.md`; then the shell from `layouts.md`.
4. Add pages feature by feature, each with list → dialog CRUD → detail, using `useScoped`.
5. Put every external system behind an adapter interface in `packages/integration` with a mock implementation so the UI ships before the backend.
