---
name: wit-ui-style
description: House UI style and code structure (frontend + backend) for admin dashboards, analytics consoles, operator kiosks and mobile PWAs. Borderless cards on a soft grey canvas, one ink surface + one accent, pill controls, a floating dark rail with a round create button, tinted stat tiles, ink record heroes with lifecycle steps, attention strips, searchable comboboxes, menus that become bottom sheets on phones, SVG charts with one accent highlight, phone bottom bars with role shortcuts, and phone/tablet/desktop rules; pnpm/Turborepo monorepo (types → fixtures/ui → apps), one reducer store with actor-stamped entity/verb actions, blockers, permissions, scoped hooks, entity dialogs, node:test journeys and CI; backend as apps/api (Fastify + Prisma + zod + BullMQ) behind the same adapter contract. Colour-agnostic (semantic tokens, a client palette mapped from its logo). Use when building, scaffolding or restyling a dashboard, admin panel, analytics page, mobile app, PWA, kiosk, UI component or the API behind them.
---

# WIT UI style (dashboard, analytics, operator PWA)

Use this whenever you generate or restyle a dashboard, admin console, analytics page, operator kiosk, mobile PWA or component set.
The look is a **"smart-home console"**: a soft grey canvas, big white rounded cards floating on it, one dark *ink* surface for emphasis, one *accent* colour for the single most important thing on screen, everything else neutral. Controls are pills. Type is one sans face (DM Sans) plus a mono face (JetBrains Mono) for identifiers.

The style is **colour-agnostic**: this skill defines semantic tokens and how to use them, and the project supplies the palette (accent and info, plus ink and canvas when the brand needs its own). See `references/tokens.css`. The MES platform (WIT red accent) is the reference implementation of this version. monitoring-system is the reference for a client brand (Indomaret: blue ink, red accent, yellow stripe), and `references/branding.md` maps a client's logo colours onto the tokens. The CMMS console is the reference for long record pages with a side column, print, the calendar, review reports and the phone's guided step flow. The builds live on this machine at `~/Documents/works/mes`, `~/Documents/works/monitoring-system` and `~/Documents/works/cmms` (`packages/ui`, `apps/*` and each repo's conventions doc); when a recipe here leaves a detail open, read it there.

## 1. Tokens you must expose (semantic, not brand)

| Token | Role | Default (neutral) |
|---|---|---|
| `accent` (+ `accent-soft`) | the ONE highlight: icons, dots, the accent period in titles, the chart highlight, big numbers on the accent card, danger tints | project supplies |
| `accent-strong`, `accent-dark` | solid accent fills behind small white text (primary button, accent badge, active phone tab, count badge) and their hover; keeps white text at WCAG AA | project supplies (about 12% and 25% darker) |
| `ink`, `ink-2`, `ink-3` | dark emphasis surface: rail, hero card, active pill, secondary button, toast, tooltip | `#101112 / #1b1c1e / #26282b` |
| `surface`, `surface-2` | page canvas / nested soft panel | `#f1f0f1 / #f5f4f6` |
| `card` | raised white card | `#ffffff` |
| `border` | hairlines: table rows, inputs, dividers, floating panels | `#e6e5e7` |
| `foreground`, `body`, `muted`, `silver` | text: title / paragraph / secondary (AA on card and canvas) / disabled and timestamps | `#101112 / #333 / #686868 / #c0c0c0` |
| `info`, `info-soft` | the only second hue: in-progress states, informational callouts, a second chart series | project supplies (a calm blue works) |
| `success`, `warning` (+ `-soft`) | status tints; the solid values pass AA as text on their own tint | `#047857 / #975000` |
| `danger` (+ `-soft`) | aliases of accent | accent |
| `chart-muted` | grey context marks beside the one highlighted value | `#d4d3d6` |
| `on-ink`, `on-ink-muted` | text on dark surfaces | `#fff / #b8b8b8` |
| `highlight` (+ `highlight-soft`) | optional third brand colour: the stripe in app icons and marks, the selected ring on a map; never text, never a state | accent |

Shadows `shadow-card`, `shadow-float`, `shadow-glow` (accent-tinted) and `shadow-up` (the phone tab bar); radii `rounded-card` (24px) and `rounded-hero` (28px); `font-mono`; utilities `safe-b`, `safe-t`, `no-scrollbar`.
A client brand may supply the ink as well: its dark brand colour works when white text on it reaches 4.5:1 (Indomaret blue `#006AB3`, 5.66:1). The greys and the shadow colour then take a trace of that hue, `on-ink-muted` becomes a pale tint of it, and the accent stays off it as text (the Indomaret red on that blue measures 1.09:1). `references/branding.md` has the mapping steps, the contrast gate and the `BRAND` hex mirror for charts, maps and SVG.
Rules: **one accent, one dark, everything else grey.** Status colours are soft tints on cards; solid colour appears only on dots, bars, chart and timeline marks, and the single most urgent card. No gradient fills. The only decorative light is the blurred accent blob inside an ink card and the faint ambient glow on the admin canvas.

## 2. Shape, elevation, spacing

- Radii: cards and dialogs 24px (`rounded-card`); ink hero cards, the rail and the right sheet 28px (`rounded-hero`); bottom sheets `rounded-t-[28px]`; mobile cards `rounded-[24px]`; nested panels, rows and inputs 16px (`rounded-2xl`); menu rows and small tiles 12px (`rounded-xl`); the md icon tile 13px. Every control, tab, chip and badge is a **full pill**.
- Elevation: `shadow-card` on cards and floating controls; `shadow-float` on the rail, dialogs, sheets, popovers, toasts and ink heroes; `shadow-glow` on the primary button and the active nav tile; `shadow-up` on the phone tab bar. **No borders on cards**; borders belong to inputs, table rows, dividers and white floating panels (menus, popovers).
- Spacing: admin canvas `p-3 lg:p-4` with **16px gaps between cards** (`gap-4`; stat rows `gap-3 sm:gap-4`); card padding `p-5` (`p-4` for strips, `p-6` for dialogs and phone heroes); page body `space-y-4`; `PageHeader` `mb-6`. Mobile screens `px-5`, sections `space-y-6` (`space-y-5` on detail screens), lists `space-y-3`.
- Canvas: the body is `surface`, cards are `card`, content nested in a card sits on `surface-2` with no shadow, and a list page's main table sits on the canvas itself (MES) or in one card with its view tabs and filters (CMMS), one form per product.

## 3. Typography (single sans, tight headings)

- DM Sans (fallback system-ui) with `ss01, cv11`, antialiased; JetBrains Mono for identifiers (codes, serials, badge numbers, endpoints) at `font-mono text-xs`.
- Scale: page title `text-2xl font-bold tracking-tight`; header page title `text-lg font-bold`; mobile screen title `text-[28px] font-bold leading-tight tracking-tight` and login or brand titles `text-3xl font-bold`, both **ending in an accent period** (`Hi, Rizky<span class="text-accent">.</span>`; on a coloured ink the period takes `highlight` or white); card title `text-base font-semibold`; dialog title `text-lg font-semibold`; body `text-sm`; secondary `text-xs text-muted`; table header `text-xs font-semibold uppercase tracking-wide text-muted`; kicker `text-[11px] font-semibold uppercase tracking-wider text-muted`.
- Numbers: stat cards `text-[28px] font-extrabold tracking-[-0.5px]`, hero metrics `text-3xl font-bold`, featured numbers `text-5xl` to `text-7xl` (`text-[56px]` on phones), always `tabular-nums`. The unit sits beside the number in muted `font-semibold`: **top-aligned** in stat cards and readings (`items-start`, `pt-1.5`), **bottom-aligned** beside hero numbers (`items-end`, `pb-0.5`).
- Inputs render at 16px on phones (`text-base md:text-sm`) so iOS never zooms into a field.

## 4. Layout shells (see `references/layouts.md`)

**Admin (desktop-first, responsive):** a full-height canvas `relative flex h-dvh gap-4 overflow-clip bg-surface p-3 lg:p-4` with a faint ambient accent glow in its own clipped box. Left, the **floating dark rail** (`rounded-hero bg-ink shadow-float`): hidden on phones, a collapsed `w-[76px]` icon rail on tablets, expandable to `w-60` from `xl` with the choice persisted. Top to bottom: wordmark (or the client logo on a white plate), a **round accent Create button** that opens the one shared create menu, section items where the current section opens its pages as sub-items, a **site or workspace switcher** card, and a labelled collapse pill. Below `xl`, a section's list pages show its pages as **pill tabs** at the top of `main`. Header (`h-14`): page title with "site · date", a pill global search with grouped results, a Create button, a round white bell with a **numbered accent badge** opening derived notifications, and a pill avatar menu. `main` scrolls on its own and restores its position on Back; a skip link jumps to it, and on paper the chrome hides so a record prints whole as a document. An API-backed shell holds pages behind a skeleton until the first load lands and shows a Try again row when it fails. **Phones (`< md`):** a **floating ink bottom bar** (`fixed inset-x-3 bottom-3 h-[68px] rounded-[22px]`: Home · three role shortcuts around a round accent Create · More), a **dark More sheet** (sticky page search, recent pages, collapsible sections as 3-column icon grids, account footer), search as an icon that opens a full-width row, and every menu as a bottom sheet; `main` gets `pb-24 md:pb-2`. Every breakpoint-only grid carries a `grid-cols-1` base and `minmax(0, …)` tracks, and the admin `main` never uses negative-margin bleed.

**Mobile PWA (`max-w-md` column):** tab roots show a white tab bar (`rounded-t-[28px] bg-card shadow-up`, 3 or 4 tabs, the active tab an `accent-strong` pill `h-9 w-14` with glow, counts as badges) and pad content `pb-32`; detail screens hide it, show a round white back button, and put the primary action in a **sticky action bar** (`h-14` button over the safe area, with a note that explains a blocker). Screen header = context line, big title with the accent period, avatar ring linking to the profile. One-step operator actions open as **action sheets** (bottom sheet with a title, a one-line rule and a soft form). Touch targets are at least 44px, 48px for choice rows, 56px for the primary action. Installable: manifest, ink theme colour, maskable icon, offline app shell, the seed in its own cached chunk. A record worked in stages (CMMS) runs as a guided step flow: a sticky header with the code and the running clock, a tappable pill stepper that locks later steps, and Back beside the step's primary in the sticky bar.

## 5. Component recipes (see `references/components.md` for exact classes)

- **Button**: pill, `h-10 px-4 text-sm font-semibold`, `active:scale-[0.98]`; variants primary (`accent-strong` + glow), secondary (ink), outline, ghost, link, danger (soft to solid), card (white with shadow, for utility buttons on the canvas), soft (inside white cards), onInk (on ink and accent surfaces); sizes sm/md/lg/icon/icon-sm/icon-lg; `loading` swaps the first icon for a spinner.
- **Card**: default, **ink** (hero; draws its own blurred accent blob, never add a second), **accent** (the one urgent metric), soft (nested panel). `CardHeader action` wraps its actions under the title on phones. On paper a card takes a hairline border and never splits.
- **IconTile** and one `Tone` union (default, danger, success, warning, info, ink, accent) shared by tiles, stat cards, dots and status maps; soft tints, ink and accent the only solid fills.
- **StatCard**: label, value, muted unit, hint and a tinted square tile; clickable tiles apply their filter; the tone follows the count; one ink tile per row.
- **Badge** with one component per status union (outline draft, default planned, ink committed, info in progress, warning paused or in review, danger failed, success done, accent the one "act now" value, muted closed); **CountBadge** for nav counters; **StatusDot** that pulses on live states.
- **Input / Textarea / NativeSelect / FormField**: variants default (bordered), soft (inside cards and sheets) and pill (search); FormField wires id, description and error through context; errors show after the first submit.
- **Combobox / MultiCombobox**: **searchable by default** (pinned search, secondary line, disabled rows with a reason, clear and create rows, keyboard, a bottom sheet on phones) and wrapped per entity as named pickers; plain selects only for fixed enums of 6 or fewer.
- **SecretField** (write-only: a stored secret shows a masked placeholder and "Leave this empty to keep it") and **unavailable options** (a feature outside the rollout stays visible and disabled with a hint that says it comes later).
- **BrandMark**: the client's logo, bare on white and on a white plate over ink, compact in the collapsed rail.
- **Gauges**: a `SensorPointCard` holding a `RadialGauge` (the band between the configured limits in green, below it info, above it accent, an ink needle), a `LevelBar` or a `StateDial`; the scale runs 10 past each limit so an out-of-band reading still lands on the dial.
- **Data states** for API-backed apps: skeleton blocks, a Try again row or card, an error-boundary card with "Sign out and reload", and a live region that announces new events.
- **SegmentedControl** for answers (Pass / Fail with tones), a choice grid for longer option sets, **Switch** in two sizes.
- **Tabs**: pill (view switch, ink active), underline (inside cards, accent underline), segmented (equal-width mobile tabs, the urgent tab accent); scrolling lists fade at the right edge.
- **Chip / ChipRow**: `filter` chips (ink when active, with counts) on the canvas, default chips (accent when active) inside cards; ChipRow scrolls with no negative margins.
- **Steps** (lifecycle pills: current ink, done white with a green check, upcoming grey, skipped), **ProgressBar** (ink by default, accent over the limit), **SegmentBar** with a dot legend.
- **DataTable**: uppercase muted headers, row dividers, `hideBelow` per column, a phone-only badge line in the first cell, a round open button on clickable rows (or a title link plus Enter on the row), `1-12 of 52` pagination, sort and page restored after Back.
- **KeyValue**, **EmptyState** (title, how records arrive, next action), **Banner** (five tones, used for blockers and rules), **SplitStats**, **PageHeader** + **Kicker**, **Avatar / AvatarStack**, **PhotoInput**, **SignaturePad**, **LazySentinel**.
- **Dialog** (one entity dialog per entity, form mounted only while open, focus handed back to whatever opened it), **ConfirmDialog** (question title with the code, one-sentence consequence, reason fields as children, destructive variant), **Sheet** (floating right panel or phone bottom sheet), **ActionMenu** (dropdown from `md`, bottom sheet on phones), **Tooltip**, **Toast** (ink, three tones).
- **Rail** and **BottomBar** parts; **charts** (Sparkline, BarStrip, BarList, ColumnChart, LineChart, Donut) in `references/charts.md`; recurring **composite rows** (nested row, ranked row, history row, check list, link chips, tree row, revision timeline, reading tile, settings list).

## 6. Page patterns (see `references/patterns.md`)

Dashboard = pill view switch → **attention card** (tiles for each non-empty queue, urgent ones on accent-soft, each a deep link) → hero grid (`xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`: the featured record on ink, the accent card and two stat cards) → status overview row → two list cards + an analysis card; roles without it get a **role home** of their next actions. **List page** = `PageHeader` (one-sentence purpose, pill search, primary) → clickable stat tiles → filter chips and inline pickers → `DataTable` on the canvas. **Detail page** = Back + the next lifecycle step as primary + an overflow ActionMenu → blocker note → **ink hero** (mono code, title, badges, metric grid, progress) → `Steps` card → KeyValue cards → related rows → history → dialogs. Also covered: master-data console (domain tabs, entity tables, field-driven dialogs), revisioned documents (draft, review, released, obsolete; compare view), approval queues, dispatch boards, Gantt timelines, record-picker trace pages, analytics with insight and recommendation cards, the operator kiosk station, measurement entry, the integration console, galleries, spatial views, setup wizards, and the mobile hub, list, record, login and profile screens. From monitoring-system: a **Live points** gauge grid on device detail, a server-settings console that edits a draft and saves only when it changed, the mobile devices screen (outlet tabs, a floor plan that starts collapsed, sensor tiles that open a gauge sheet), and a sign-in that carries the client logo. From CMMS: a list page whose view tabs, filters and table share one card; a long record page (one state-driven primary, a banner stack, a sticky section nav, a `minmax(0,1fr)_340px` side column of small-caps cards); a tabbed record passport; approval decision cards; master data as tabbed lists with guarded deletes; a calendar with drag to reschedule; a review report whose chart cards flip to tables and export CSV; and on the phone a technician home, the guided step flow with a safety gate and typed checklist lines, a problem report and a scan screen.

## 7. Interaction, motion, accessibility

- Motion stays subtle: `transition-colors` on hover, `active:scale-[0.98]` on tappable cards and buttons, fades and slides on overlays, `animate-pulse` on live dots (a running machine or job, an alarm) and `animate-ping` rings while a badge reader waits. Nothing else animates.
- Hover is `surface` on white (`bg-surface-2` rows hover to `bg-surface`), `white/10` on dark; the focus ring is `ring-2 ring-accent/40` on every interactive element. On a coloured ink, where accent/40 fades, add the strong ring from tokens.css (a white outline plus an ink ring).
- `prefers-reduced-motion` stops animations and transitions (a base rule in tokens.css).
- With a server behind the store, the busy button shows `loading`, a success toast or view waits for the server's answer, and a refused request keeps the form as it was with the server's reason in a danger toast.
- Every mutation ends in a **toast** (past-tense result, the record in the description). A blocked action **says why** with the same blocker text the store uses (Banner, `title`, ActionMenu description, danger toast). Actions a role cannot take are **hidden**, never disabled.
- Forms show errors after the first submit, mark required fields, show defaults as placeholders with a hint, and name the submit with its verb.
- Keyboard: roving arrows in tabs, segmented controls and chart marks; arrows, Enter and Escape in comboboxes and search; a real open button in each clickable table row; focusable charts with a live region.
- Tokens pass AA; icon-only controls carry `aria-label`s with their counts; nav uses `aria-current`; charts, bars and avatars are `role="img"` with labels.
- One `h1` per page (`sr-only` when the design shows none) with card titles one level below; a skip link jumps past the rail to `main`; dialogs and sheets hand focus back to whatever opened them, a menu item included.
- Every button does something real; empty states offer the next action.

## 8. Do / don't

- Do keep **one accent per screen region**; when a region already has an accent card, make the next emphasis ink.
- Do use `accent-strong` for a solid accent behind small white text; keep `accent` for icons, dots, marks and big numbers.
- Do put the unit beside the number, muted. Do end mobile and login titles with the accent period.
- Do make stat tiles clickable filters, keep list state across Back, and put filters other pages link to in the URL.
- Do open every record on its own route, with a Back button that lands on the list as the user left it; a right sheet serves quick triage only.
- Do take a client's colours from their logo file and pass the contrast gate in `references/branding.md` before building screens; a remembered palette cost monitoring-system a second rebrand.
- Don't write a colour as hex or rgb in a class string or a component: glows use `shadow-glow`, tints use token opacity, and charts, maps and SVG read `BRAND`. monitoring-system's rebrand left nine glows in the previous palette's red.
- Don't border cards, stack shadows, use gradient fills, mix icon sets (lucide, stroke 2) or square a corner that can be a pill.
- Don't add a second blob to an ink card: `Card variant="ink"` draws one behind the content, and a hand-added copy paints over the badges.
- Don't mix list-page forms in one product: the main table sits on the canvas under stat tiles and chips (MES), or the view tabs, filters and table share one card (CMMS). A section table on any other page sits in a card.
- Don't disable a button because of a missing permission (hide it), and don't disable one for a state reason without saying why.
- Don't open a left drawer or an anchored dropdown on a phone. Menus, pickers, filters and notifications slide up as bottom sheets.
- Don't stack more than about 6 list items on mobile without tabs and lazy loading.
- Don't edit released records in place; copy them or raise a change.
- Don't ship a screen without checking it at 375 and 768 wide: `main.scrollWidth` must equal `main.clientWidth`. Check a record page in print preview too.
- Don't invent new greys; use the token ladder.

## 9. Clean code structure (see `references/architecture.md`)

Monorepo `apps/* + packages/*` (types → fixtures / ui / integration → apps, dependencies only point down), with a desktop console and a phone PWA sharing the kit and the store package.
Each app is layered `main → router → auth → state (reducer store + scoped hooks) → layouts → pages/<feature> → components → lib`.
Domain types first (`*_LABEL`, `*_FLOW`); seeded, deterministic fixtures on an app clock; one reducer with `entity/verb` actions in an envelope stamped with the actor and time; blocker functions shared by the reducer and the UI; a permission map with `can()`; `useScoped()` views instead of ad-hoc filtering; a versioned persisted state with a storage-failure banner; history-scoped list state; a detail route per record type, loaded per page; simulated jobs dispatched as `system`; one `<Entity>Dialog` per entity and a shared ConfirmDialog; every external system behind an adapter with a mock. Strict TypeScript, ESLint with react-hooks, `node:test` journey tests, and CI that checks the seed, types, lint, tests and build.

**Backend** (see `references/backend.md`): `apps/api` in the same monorepo, TypeScript end to end (Fastify + Prisma/PostgreSQL + zod + BullMQ). Shared `packages/contracts` (zod schemas) is the single source of truth for both the API and the frontend `HttpApi`. One module folder per feature (`routes → service → repo`), every query tenant-scoped (the server twin of `useScoped`), REST routes mirror the reducer's `entity/verb` actions, ingestion pipeline `receive → verify → parse → normalise → alert-engine → outbox → workers`, notifiers behind one interface, problem+json errors, contract tests run against both mock and http adapters.

## Workflow

0. New project? Scaffold the workspace and app layering from `references/architecture.md` first; if a backend is in scope, add `apps/api` + `packages/contracts` from `references/backend.md`.
1. Copy `references/tokens.css` into the project theme and fill in `accent`, `accent-strong`, `accent-dark`, `accent-soft`, `info` and `info-soft` (and `ink` / `surface` when the brand needs them); check white text on `accent-strong` and `muted` text on `surface` pass AA. For a client brand, follow `references/branding.md`: sample the logo, map ink, accent and highlight, tint the greys and shadows, run the contrast gate, mirror the values in `lib/brand.ts`, and swap in the logo and app icons.
2. Build the kit from `references/components.md` and `references/charts.md`, then the shell from `references/layouts.md` (admin, mobile, or both).
3. Compose screens from `references/patterns.md`; write the repo's `docs/frontend-conventions.md` (CMMS: `docs/conventions.md`) naming its reference pages.
4. Before finishing, run the checklist at the end of `references/patterns.md` and the quality gates in `references/architecture.md` / `references/backend.md`.
