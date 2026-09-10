---
name: wit-ui-style
description: House UI style AND clean code structure (frontend + backend) for admin dashboards and mobile PWAs (the "monitoring-system" look) — roomy rounded cards on a soft grey canvas, one dark ink surface + one accent, pill controls, floating dark icon rail, bottom pill tab bar; pnpm/Turborepo monorepo with types → fixtures/ui/integration → apps layering, single reducer store, scoped hooks, entity dialogs; backend as apps/api (Fastify + Prisma + zod contracts + BullMQ) implementing the same adapter contract with tenant-scoped modules. Colour-agnostic (semantic tokens, palette supplied per project). Use whenever generating, scaffolding or restyling a dashboard, admin panel, mobile app, PWA, UI component, or the API/backend behind them, so it matches this style and structure.
---

# WIT UI style (dashboard + mobile PWA)

Use this whenever you generate or restyle a dashboard / admin panel / mobile PWA / component set.
The look is **"smart-home console"**: a soft grey canvas, big white rounded cards that float on it,
one dark *ink* surface for emphasis, one *accent* colour for the single most important thing on
screen, everything else neutral. Controls are pills. Type is one sans face (DM Sans by default).

The style is **colour-agnostic**: this skill defines semantic tokens and how to use them; the
project supplies the palette (accent, ink, canvas). See `references/tokens.css`.

## 1. Tokens you must expose (semantic, not brand)

| Token | Role | Default (neutral) |
|---|---|---|
| `accent` (+ `accent-soft`) | the ONE highlight colour: primary CTA, active tab/nav, danger-level alerts, the red "period" in headings | project supplies |
| `ink`, `ink-2`, `ink-3` | dark emphasis surface (rail, hero card, active pill, secondary button) | `#101112 / #1b1c1e / #26282b` |
| `surface`, `surface-2` | page canvas / nested soft panel | `#f1f0f1 / #f5f4f6` |
| `card` | raised white card | `#ffffff` |
| `border` | hairline dividers | `#e6e5e7` |
| `foreground`, `body`, `muted`, `silver` | text: title / paragraph / secondary / disabled | `#101112 / #333 / #8b8b8b / #c0c0c0` |
| `info`, `info-soft` | the only allowed second hue: neutral-informational states (responded, scheduled, callouts) | project supplies (a calm blue works) |
| `on-ink`, `on-ink-muted` | text on dark surfaces | `#fff / #8b8b8b` |

Rules: **one accent, one dark, everything else grey.** Status semantics (success / warning /
danger) may use conventional green / amber / accent but always as *soft tints* on cards and *solid*
only on the small dot or the single most urgent card. Never gradients as fills; a blurred accent
blob behind a dark hero is the only decorative light allowed.

## 2. Shape, elevation, spacing

- Radii: card `24px` (`rounded-[24px]` / `rounded-card`), large hero/dialog `28px`, nested panel/input `16px` (`rounded-2xl`), icon tile `12–16px`, every control/tab/chip/badge is a **full pill** (`rounded-full`). Rail/sidebar `28px`.
- Elevation: `shadow-card = 0 1px 2px rgb(ink/0.03), 0 8px 24px -12px rgb(ink/0.12)` for cards and floating controls; `shadow-float = 0 12px 40px -12px rgb(ink/0.25)` for the rail, dialogs and hero cards. Primary buttons get a coloured glow `0 8px 20px -8px accent/0.6`. No borders on cards — elevation separates them; borders only on inputs and table rows.
- Spacing: page padding 12–16px (`p-3 lg:p-4`) with **16px gaps between cards**; card padding `p-5`; mobile page `px-5`; lists `space-y-3`; sections `space-y-6` (mobile) / `space-y-4` (admin).
- Canvas: body is `surface`; cards are `card`; nested content inside a card sits on `surface-2` (no extra shadow).

## 3. Typography (single sans, tight headings)

- Face: DM Sans (fallback system-ui). Enable `ss01, cv11`. Antialiased.
- Scale: page title `text-2xl font-bold tracking-tight`; mobile screen title `text-[28px] font-bold leading-tight tracking-tight` and it **ends with an accent-coloured period** (`Welcome, Rizky<span class="text-accent">.</span>`); card title `text-base font-semibold`; body `text-sm`; secondary `text-xs text-muted`; table header `text-xs font-semibold uppercase tracking-wide text-muted`; kicker/eyebrow `text-[11px] font-semibold uppercase tracking-wider text-muted`.
- Big numbers: `text-3xl font-bold leading-none tracking-tight` in stat cards, `text-4xl`–`text-6xl` in readouts/hero, unit as `text-sm font-semibold text-muted` top-aligned beside the number. Numbers use `tabular-nums`.
- Monospace only for identifiers (serial, MAC, IP, IDs) at `font-mono text-xs`.

## 4. Layout shells

**Admin (desktop-first, responsive):** full-height flex canvas with `p-3 lg:p-4 gap-4`. Left: a **floating dark icon rail** (`w-[76px]`, `rounded-[28px] bg-ink shadow-float`, expands to `w-60` with labels; state persisted). Rail items are `size-11 rounded-2xl`; the active one is a solid **accent** tile with glow; unread counts as a tiny white badge. Top bar (`h-14`): page title + context line, a pill search input (`rounded-full bg-card shadow-card`, no border), a primary CTA, a round icon button with notification dot, a pill avatar menu. Main scrolls independently. **Breakpoints:** `≥ md` (768) shows the collapsed icon rail (tablet); `< md` (phone) replaces it with a left drawer sheet + round menu button, and the pill search collapses into a round icon button that opens a full-width search row under the header. Every grid that only defines columns at a breakpoint MUST carry a `grid-cols-1` base (`grid grid-cols-1 gap-4 xl:grid-cols-[…]`) — without it the implicit `auto` track stretches to the widest nowrap child and the whole page scrolls sideways on phones. Never use negative-margin bleed rows inside the admin main (it has its own scroll box); bleed rows are a mobile-PWA-only pattern. See `references/layouts.md` → Responsive rules.

**Mobile PWA (`max-w-md` centred, full-bleed):** header = greeting line + big title with accent period + avatar (`size-12 ring-4 ring-card shadow-card`) on the right. Horizontal pill-chip filter row that bleeds past the padding (`-mx-5 px-5 overflow-x-auto`). Content in `space-y-6`. **Bottom tab bar**: fixed, `rounded-t-[28px] bg-card` with an upward shadow and a gradient fade above it; 3–4 tabs; the active tab is an accent pill `h-9 w-14 rounded-full` with glow, label `text-[11px] font-semibold`; badges as accent counters. Hide the tab bar on detail screens (back arrow in a round white button instead). Pad content `pb-32` so nothing hides under the bar; respect safe-area insets.

## 5. Component recipes (see `references/components.md` for exact classes)

- **Button**: pill, `h-10 px-4 text-sm font-semibold`, `active:scale-[0.98]`; variants primary (accent + glow), secondary (ink), outline (card + border), ghost, link; sizes sm/md/lg/icon(`size-10`). Icons `size-4`.
- **Card**: `rounded-card bg-card shadow-card`, header `p-5`, content `p-5 pt-0`. Hero variant: `bg-ink text-on-ink` with one blurred accent blob top-right.
- **Stat card**: label `text-sm font-medium text-muted` + round tone icon (`size-10 rounded-full`) on the first row, big number below, hint `text-xs text-muted`. Tone: default grey, danger accent, success ink, warning info.
- **Badge**: pill `px-2.5 py-0.5 text-xs font-medium`, optional 6px dot; variants default / accent / success / warning / danger / info / muted / outline.
- **Input**: `h-11 rounded-2xl border bg-card px-4 text-sm`, focus = accent border + soft ring; optional left icon; inside white cards use `border-0 bg-surface`. Search bars are pills with no border.
- **Tabs**: *pill* (`rounded-full bg-card p-1 shadow-card`, active trigger `bg-ink text-on-ink`) for view switches; *underline* (accent underline) inside cards. Mobile list tabs: segmented pill where the "open/urgent" tab is accent and others ink.
- **Chips**: `h-10 rounded-full` white with border; active = accent. Filter rows use `bg-ink` for the selected chip.
- **Toggle**: `h-7 w-12` pill, accent when on.
- **Table**: `DataTable` in a card; uppercase muted headers; row hover `surface-2`; pagination row with two round outline icon buttons; clickable rows navigate, row-level edit/delete are ghost icon buttons revealed on the right.
- **List item / mobile card**: `rounded-[24px] bg-card p-4 shadow-card`, leading `size-12 rounded-full` tone tile with icon, title row (bold + status text with dot on the right), muted subtitle, `mt-3` message line, `active:scale-[0.98]`. Resolved items are `bg-card/70`.
- **Key/value sheet**: `dl` in a card with `divide-y`, rows `grid grid-cols-[96–120px_1fr] py-3.5 text-sm`, label muted.
- **Empty state**: round `size-12 bg-surface` icon, bold title, muted description, optional action.
- **Dialog / Sheet**: `rounded-card p-6 shadow-float`, overlay `ink/50` with slight blur; forms in `grid sm:grid-cols-2 gap-4`; footer buttons right-aligned, outline Cancel + primary Save. Destructive confirms use AlertDialog.
- **Banner / callout**: `rounded-card bg-info-soft px-4 py-3` with a round white icon tile, bold lead-in, muted copy, small CTA.
- **Avatar**: initials on a per-user colour, circle, sizes 28/36/48/80.

## 6. Page patterns (see `references/patterns.md`)

Dashboard = view switcher (pill tabs) → hero grid (`lg:grid-cols-[1.5fr_1fr]`: dark featured card + accent "needs attention" card + two small stat cards) → summary strip → 3 stat cards → two list columns + analysis card. On tablet the list columns pair up (`md:grid-cols-2`, analysis spans both); on phones mini stat tiles go 3-up / 2-up, the 3 stat cards become a swipeable snap row, list rows show a compact status line under the title, and captions like "point of view" hide. Master data = `PageHeader` (title, description, search + primary "Add") → card with `DataTable` → dialog CRUD → `ConfirmDelete`. Detail = back link + grid of key/value card and related-list cards. Mobile list = header → chip filter → segmented tabs → lazy-loaded cards (6 per page, sentinel "N more · Load"). Mobile detail = round back button → dark hero card with big value → key/value card → soft-info card → form card → sticky primary CTA. Wizard = 6-step pill stepper, one card per step, Back/Continue row.

## 7. Interaction & motion

Subtle only: `transition-colors` on hover, `active:scale-[0.98]` on tappable cards/buttons, `animate-pulse` for live alarm markers, `animate-in fade-in` for overlays. Hover states on white are `surface`, on dark are `white/10`. Focus ring `ring-2 accent/40`. Every button must do something real; empty states always offer the next action.

## 8. Do / don't

- Do keep **one accent per screen region**; when a screen already has an accent card, make the next emphasis ink, not another colour.
- Do put the unit beside the number, muted, top-aligned. Do end mobile titles with the accent period.
- Don't use borders around cards, drop shadows on everything, gradients, more than one icon style (use lucide, stroke 2), or square corners anywhere a pill is possible.
- Don't stack more than ~6 list items without tabs/lazy-load on mobile.
- Don't ship a screen without checking it at 375 and 768 wide: `main.scrollWidth` must equal `main.clientWidth`.
- Don't invent new greys; use the token ladder.

## 9. Clean code structure (see `references/architecture.md`)

Monorepo `apps/* + packages/*` (types → fixtures / ui / integration → apps, dependencies only point down).
Each app is layered `main → router → auth → state (reducer store + scoped hooks + live lookups) → layouts → pages/<feature> → components → lib`.
Domain types first; seeded generated fixtures; one reducer with `entity/verb` actions and in-reducer cascades; `useScoped()` views instead of ad-hoc filtering; one `<Entity>Dialog` per master entity plus a shared `ConfirmDelete`; every external system behind an adapter interface with a mock implementation. Strict TypeScript, `pnpm typecheck` and `pnpm build` green before finishing.

**Backend** (see `references/backend.md`): `apps/api` in the same monorepo, TypeScript end to end (Fastify + Prisma/PostgreSQL + zod + BullMQ). Shared `packages/contracts` (zod schemas) is the single source of truth for both the API and the frontend `HttpApi`. One module folder per feature (`routes → service → repo`), every query tenant-scoped (server twin of `useScoped`), REST routes mirror the reducer's `entity/verb` actions, ingestion pipeline `receive → verify → parse → normalise → alert-engine → outbox → workers`, notifiers behind one interface, problem+json errors, contract tests run against both mock and http adapters.

## Workflow

0. New project? Scaffold the workspace and app layering from `references/architecture.md` first; if a backend is in scope, add `apps/api` + `packages/contracts` from `references/backend.md`.
1. Copy `references/tokens.css` into the project theme, fill in `accent`, `info`, and (optionally) `ink`/`surface`.
2. Build the shell from `references/layouts.md` (admin or mobile).
3. Compose screens from `references/components.md` + `references/patterns.md`.
4. Before finishing, run the checklist at the end of `references/patterns.md` and the quality gates in `references/architecture.md` / `references/backend.md`.
