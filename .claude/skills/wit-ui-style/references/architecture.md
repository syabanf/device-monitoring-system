# Clean code structure (monorepo + app layering)

Mirror this layout for any dashboard or mobile product in the house style: a thin UI on top of typed domain data, with every concern in one place.

## Workspace layout (pnpm + Turborepo)
```
<repo>/
  package.json            # scripts: dev, dev:<app>, preview:<app>, build, typecheck, lint, test, format, gen:fixtures
  pnpm-workspace.yaml     # packages: apps/*, packages/*
  turbo.json              # build (dependsOn ^build, outputs dist/**), dev (persistent, no cache), typecheck (dependsOn ^typecheck)
  eslint.config.js        # flat config, see quality gates
  .prettierrc             # + prettier-plugin-tailwindcss with tailwindStylesheet → the theme
  .github/workflows/ci.yml
  scripts/                # seeded, deterministic generators (generate-fixtures.ts + seed/*.ts per domain), own tsconfig
  docs/                   # blueprint + frontend-conventions.md (the day-to-day summary of this skill for the repo)
  apps/
    admin/                # desktop-first console (Vite + React 19 + Tailwind v4 + react-router 7)
    mobile/               # phone PWA for field or operator roles (same stack + vite-plugin-pwa)
  packages/
    types/                # @scope/types: domain model only (enums.ts with *_LABEL and *_FLOW, entities.ts). Zero deps.
    fixtures/             # @scope/fixtures: seed JSON in data/, the reducer store, persistence, permissions, clock, ids,
                          #   format, dates, derive (shared derivations), analytics
    ui/                   # @scope/ui: the component kit (components/*.tsx, components/charts/*, lib/*, barrel index.ts)
    tailwind-config/      # theme.css (tokens) shared by every app
    tsconfig/             # base.json, library.json, vite-react.json
    integration/          # optional @scope/integration when external systems exist: adapter contract, mock + http, parsers
```
Dependencies point down: `apps → ui / fixtures / integration → types`. `ui` never imports domain data; `types` imports nothing. Packages export source (`"exports": { ".": "./src/index.ts" }`) with no build step; apps bundle them.

## App layering (`apps/<app>/src`)
```
main.tsx          # providers in order: AppStateProvider → AuthProvider → TooltipProvider(200) → RouterProvider, plus <Toaster />
router.tsx        # createBrowserRouter; /login outside, RequireAuth around the layout; one entry per page
index.css         # @import 'tailwindcss'; @import '@scope/tailwind-config/theme.css'; @source '../../../packages/ui/src'
auth/auth.tsx     # AuthProvider + useAuth + RequireAuth: user, site, sites, signIn, signOut, switchSite, can(permission)
state/
  store.tsx       # AppStateProvider: useReducer(reduce, loadLocalState(KEY)), saveLocalState on change, storageError flag
  scoped.ts       # useAppState (envelope dispatch), useScoped() (site-scoped view), useNow(interval)
                  # mobile: scope.tsx, a MobileScopeProvider narrowing to the signed-in operator
layouts/          # AppLayout, SideRail, Header, PhoneNav, CreateMenu, GlobalSearch, notifications.tsx, nav.ts, useNavCounts.ts
components/       # cross-page pieces: badges.tsx, links.tsx (paths + link chips), pickers.tsx, create.tsx (CreateProvider),
                  #   BackButton.tsx, shared entity dialogs
lib/              # storage.ts (guarded localStorage + usePersistentState), history-state.ts (useHistoryState, useTableHistory)
pages/<feature>/  # FeaturePage.tsx, FeatureDetailPage.tsx, dialogs.tsx, lib.ts (page-local derivations), feature components
```
Rules
- A page composes; it owns no business rules. Derivations live in `packages/fixtures` (`derive.ts`, `analytics.ts`) or in the feature's `lib.ts`.
- One dialog per entity (`<Entity>Dialog` with `open`, `onOpenChange`, `editing: Entity | null`, `onSaved`), with the form mounted only while open. Pages hold `editing` / `removing` / `pending` state and nothing more.
- Actions that several pages offer on the same record come from one hook (`useWoActions()` → `items(record)`, `open(kind, record)`, `dialogs`), so menus and dialogs stay identical everywhere.
- Feature-local components stay in the feature folder; promote to `components/` on the second use and to `packages/ui` once they carry no domain imports.
- Hooks are `useX` files next to their users; pure functions get `.ts`, JSX gets `.tsx`.
- Every record type has its own detail route (`/assets/:id`, `/work/orders/:id`; `new` as the id creates, `/preventive/job-plans/new`), built only through `paths.*`. Routes load per page, so each feature ships as its own chunk (CMMS): `const page = (load, name) => async () => ({ Component: (await load())[name] })` and `{ path: 'assets/:id', lazy: page(() => import('./pages/assets/AssetDetailPage'), 'AssetDetailPage') }`, with a `HydrateFallback` of the bare canvas; a section root (`/work`) redirects to its first page.

## Data and state conventions
- **Domain types first**: every entity in `packages/types/entities.ts`; unions in `enums.ts` with a `*_LABEL` map beside each (`MO_STATUS_LABEL`), a `*_FLOW` array for lifecycles that feed Steps (`MO_STATUS_FLOW`), and shared subsets (`OPEN_MO_STATUSES`). IDs are prefixed strings (`mo-…`, `wo-…`); human codes run in sequence (`nextCode(existing, 'WO-2026-', 6)` → `WO-2026-002820`).
- **Fixtures are generated**: `scripts/generate-fixtures.ts` (with `scripts/seed/<domain>.ts` modules) is seeded and deterministic and writes JSON to `packages/fixtures/data/`. A fixed `FIXTURE_NOW` anchors all relative time, and an app clock (`nowMs()`, `nowIso()`) starts at `FIXTURE_NOW` and ticks in real time, so timers and "x ago" labels move while the seed stays consistent. CI regenerates the seed and fails on any diff.
- **Single reducer store** in `packages/fixtures/src/store.ts`: `AppState` holds every editable collection; `AppAction` is a discriminated union named `entity/verb` (`manufacturingOrders/release`, `workOrders/recordOutput`, `inspections/record`); cascades run inside the reducer (`cascadeRemove`). Every action travels in an envelope, `reduce(state, { action, meta: { by, at } })`, and the scoped dispatch stamps the signed-in user and the app clock, so history rows show who did what and when.
- **Simulated jobs**: work a backend would run on a timer dispatches from the store provider on load and every minute with `meta.by = 'system'` (CMMS's PM scheduler raises a work order once a schedule's lead time starts), and the UI names that actor ("PM scheduler"). The backend replaces it with a queue job behind the same action.
- **Blockers**: one `<entity><Verb>Blocker(state, record): string | null` per guarded transition (`moCompletionBlocker`, `woCompletionBlocker`, `outputBlocker`, `deliveryBlocker`). The reducer refuses the action with it, and the UI shows the same sentence beside the disabled button, in a Banner or as a danger toast.
- **Permissions**: a `Permission` union (`mo.release`, `quality.execute` …), `BY_ROLE: Record<Role, Permission[]>`, and `can(role, permission)` in the store package; `useAuth().can(permission)` gates rendering.
- **Scoped views**: `useScoped()` returns memoised, site-filtered collections, `maps.<entity>` (`Map` by id), name helpers (`productName`, `personName`, `orgName`, `uomCode`, `reasonLabel`) and `dispatch`. The mobile app's `useMobileScope()` narrows further to the operator (their work orders, their work centers, `canOpen(id)`). Pages never filter the raw store by site themselves; renamed entities propagate because every lookup reads the live maps.
- **Persistence**: the whole state persists as a versioned envelope `{ version, state }` under `<ns>.<app>.state.v1`. Loading falls back to a clean seed on a version change or corrupt data; saving reports failure, and the shell shows a danger Banner ("Changes cannot be saved"). Each app keeps its own copy (`<ns>.admin.*`, `<ns>.mobile.*`); a "Reset demo data" action removes the app's keys and reloads.
- **UI state**: per-viewer preferences through `usePersistentState(key, initial)` (rail expanded, dashboard view, read notifications, recent pages), wrapped in try/catch because storage can be missing; list search, filters and table sort and page through `useHistoryState(name, initial)` and `useTableHistory()`, stored per history entry so Back restores them; anything another page links to (`?view=`, `?tab=`, `?id=`) in the URL.
- **Notifications are derived** from the state on each render, never stored, so they clear themselves; only the read ids persist.
- **Integration blackbox** (when external systems exist): an adapter interface in `packages/integration/adapter.ts`, `createMockApi(readers)` over the store and `createHttpApi(config)` for the backend, parsers that normalise inbound payloads, a persisted `IntegrationConfig`. The UI imports only the interface.

## Component and styling conventions
- Kit components are React 19 function components: props extend `ComponentProps<'button'>` (ref arrives as a prop, no `forwardRef`), variants come from `cva`, classes merge through `cn()` (tailwind-merge extended with the custom radius and shadow tokens), `asChild` uses `Slot.Root` from `radix-ui`, and state styling keys off `data-[state=…]` / `data-[active=…]`. Contexts render as `<Ctx value={…}>`; callbacks read inside effects use `useEffectEvent`; media queries and the toast store use `useSyncExternalStore`.
- Kit files are kebab-case (`dropdown-menu.tsx`) with PascalCase exports and one barrel `index.ts` grouped as lib, primitives, form controls, navigation, data display, overlays, shell, charts.
- App components are PascalCase files; pages end with `Page`, modals with `Dialog`, bottom forms with `Sheet`; status badges live together in `badges.tsx`, link chips and the `paths` map in `links.tsx`, named comboboxes in `pickers.tsx`.
- Tailwind only (no CSS modules); semantic tokens from `theme.css`; arbitrary values only for the fixed radii and sizes in this guide; class order formatted by `prettier-plugin-tailwindcss` with `tailwindStylesheet` pointing at the theme so it knows the custom utilities.
- Icons: lucide-react only, imported by name; a domain switch component maps an enum to an icon.
- Formatting and dates live in the store package (`fmtDate`, `fmtTime`, `fmtAgo`, `fmtDuration`, `fmtNumber`, `fmtPercent`, `fmtIdr`, `plural`; `toMs`, `addDays`, `startOfDay`, `toDateInput`); JSX never calls `toLocaleString`.
- `docs/frontend-conventions.md` in each repo names the reference pages to copy (a dashboard, a list, a detail), the shared helpers and the phone-breaking layout rules, so a new page starts from the house pattern. CMMS keeps the same content in `docs/conventions.md`, plus the domain rules the store enforces, the accessibility and print rules, and the writing rules.

## TypeScript and quality gates
- `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `isolatedModules`, `moduleResolution: 'Bundler'`, `noEmit`; `import type` (inline) for types. No `any`; narrow with discriminated unions; prefer `Record<Enum, string>` maps over switch statements for display text and variants.
- ESLint flat config: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` (`rules-of-hooks` and `exhaustive-deps` as errors), `@typescript-eslint/consistent-type-imports` with inline type imports, `no-unused-vars` ignoring `_`-prefixed names, `no-console` except `warn` and `error` (off for scripts). Ignore `dist`, `dev-dist`, `.turbo` and the seed data.
- Tests with `node:test` through `tsx --test` on the store package: reducer tests, journey tests that drive a whole flow through `reduce` (create, release, dispatch, execute, inspect, close) and assert every intermediate state, and modelling tests for the derivations.
- Prettier: `semi: false`, `singleQuote: true`, `printWidth: 110`, `trailingComma: 'all'`.
- CI (GitHub Actions, Node 22, pnpm with a frozen lockfile, cancel-in-progress per ref): regenerate the seed and `git diff --exit-code -- packages/fixtures/data`, then `pnpm typecheck` (every package, both apps and the scripts project), `pnpm lint`, `pnpm test`, `pnpm build`. All must pass before finishing.
- Effects only for subscriptions and observers; derived data through `useMemo` on store slices; never copy store state into local state (reset local state with a `key`, or by comparing a stored reset key during render as `useLazyList` and `DataTable` do).

## Naming cheat sheet
| Thing | Convention | Example |
|---|---|---|
| package | `@scope/<name>` | `@mes/ui` |
| page | `<Feature>Page`, `<Feature>DetailPage` | `WorkOrdersPage`, `WorkOrderDetailPage` |
| entity dialog | `<Entity>Dialog` | `ManufacturingOrderDialog` |
| reducer action | `entity/verb` | `workOrders/recordOutput` |
| action envelope | `{ action, meta: { by, at } }` | `meta: { by: 'per-operator', at: nowIso() }` |
| blocker | `<entity><Verb>Blocker(state, record)` | `moCloseBlocker` |
| scoped hook | `useScoped`, `useMobileScope`, `use<Thing>` | `useNavCounts` |
| label / flow / variant map | `<ENUM>_LABEL`, `<ENUM>_FLOW`, `<ENUM>_VARIANT` | `WO_STATUS_LABEL`, `MO_STATUS_FLOW` |
| permission | `<area>.<verb>` | `quality.release` |
| storage key | `<ns>.<app>.<thing>` | `mes.admin.rail`, `mes.mobile.state.v1` |
| id | `<prefix>-<random>` | `wo-m1x9k2` |
| human code | `<PREFIX>-<year>-<seq>` | `MO-2026-00324` |
| deep-link param | `?view=`, `?tab=`, `?id=`, `?new=1` | `/manufacturing/orders?view=at-risk` |

## Starting a new project with this structure
1. Scaffold the workspace tree; copy `tokens.css` into `packages/tailwind-config/theme.css` and fill in the palette.
2. Write `packages/types` first; then the seeded generator, the reducer with `entity/verb` actions in an envelope, the blockers and the permissions.
3. Build `packages/ui` from `components.md` and `charts.md`; then the shell from `layouts.md`; write `docs/frontend-conventions.md` naming the reference pages.
4. Add pages feature by feature (list, dialog, detail) through `useScoped`, following `patterns.md`.
5. Add ESLint, the `node:test` journeys and the CI workflow before the second feature lands.
6. Put every external system behind an adapter interface with a mock implementation, so the UI ships before the backend (`backend.md`).
