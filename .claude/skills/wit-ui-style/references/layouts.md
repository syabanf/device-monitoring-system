# Layout shells

## Admin shell
```tsx
<CreateProvider>
  {/* overflow-clip, not hidden: a hidden box can still be scrolled by focus and scrollIntoView. */}
  <div className="relative flex h-dvh gap-4 overflow-clip bg-surface p-3 lg:p-4">
    {/* The glow sits in its own clipped box so the shell never gains scrollable overflow. */}
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-[8%] -top-[30%] h-[120%] w-[70%] opacity-70 blur-xl" style={{ background: GLOW }} />
    </div>
    <div className="relative hidden shrink-0 md:block">
      <SideRail expanded={railPref && isDesktop} canExpand={isDesktop} onToggle={() => setRailPref(!railPref)} />
    </div>
    <div className="relative flex min-w-0 flex-1 flex-col gap-4">
      <a href="#main" className="sr-only z-30 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-on-ink shadow-float focus:not-sr-only focus:absolute focus:left-4 focus:top-3">Skip to content</a>
      <Header onMenu={() => setMoreOpen(true)} />
      <main id="main" tabIndex={-1} ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto pb-24 pr-0.5 md:pb-2">
        {storageError && <Banner tone="danger" title="Changes cannot be saved">…</Banner>}
        <SectionTabs />
        <Outlet />
      </main>
    </div>
    <PhoneNav moreOpen={moreOpen} onMoreChange={setMoreOpen} />
  </div>
</CreateProvider>
```
- `GLOW` is three radial gradients, all derived from the palette: `radial-gradient(38% 34% at 72% 22%, <accent at 9%>, transparent 70%), radial-gradient(28% 30% at 92% 48%, <accent at 6%>, transparent 70%), radial-gradient(34% 30% at 55% 8%, <light accent tint at 55%>, transparent 72%)`. It is the only decorative light on the canvas. Write each colour from the token (`color-mix(in srgb, var(--color-accent) 9%, transparent)`) or from `BRAND.accent`: monitoring-system wrote its glow as rgb literals, and it kept the previous palette's red after the rebrand.
- An API-backed app holds `<Outlet />` back until the first load lands (skeleton blocks), puts a Try again row at the top of `main` when the load fails, raises a toast when an action fails, and wraps the providers in an error boundary (components → Data states).
- `isDesktop = useMediaQuery('(min-width: 1280px)')`; the rail preference persists under `<ns>.admin.rail` and defaults to expanded.
- `main` is the scroll box. Save its `scrollTop` per history entry key: a PUSH or REPLACE navigation starts at the top, a POP (Back, Forward) restores the saved position.
- The skip link (CMMS) is the first focusable element in the content column and jumps past the rail and header to `main`, which takes `id="main" tabIndex={-1}` so it can receive focus.
- Page body: `space-y-4`, with `PageHeader` carrying its own `mb-6`.
- Grids: hero `grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`; detail pairs `grid grid-cols-1 gap-4 lg:grid-cols-2`; lists plus analysis `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]`; main plus side column `xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]` or `xl:grid-cols-[minmax(0,1fr)_340px]` (inspector). Wrap `fr` tracks that hold truncating text in `minmax(0, …)`.

### Rail (SideRail)
Tiers: below `md` the rail is hidden (the phone bar replaces it); from `md` to below `xl` it is the collapsed icon rail with no collapse control; from `xl` it expands, and the user's choice persists.
- Header: a link to `/` with the logo tile `flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/5` (mark at `size-7`) and, when expanded, the product name `block text-[15px] font-bold leading-tight tracking-tight` over a tagline `block text-[11px] text-on-ink-muted`. With a client logo, the header holds `BrandMark plate` instead (`[&_img]:w-24` expanded, `compact` in a `size-11 p-1` plate collapsed) and drops the product name when the logo already carries it.
- Action: `RailAction label="Create"` as the trigger of the shared `CreateMenu` (`side="right" align="start"`).
- Nav: one `RailItem asChild` per NAV section wrapping a `NavLink`. In the expanded rail the current section opens in place and lists its pages as `sub` items; the open section row drops the active fill and turns `text-white`, and its trailing ChevronDown rotates 180°. A closed section shows the sum of its pages' counts.
- Workspace: `RailWorkspace` (site or tenant switcher) with the "Switch site" menu and Sign out. Sign out lives in that menu, not as a rail item.
- Footer: `RailCollapse`, rendered only where the rail can expand.

NAV has one source (`layouts/nav.ts`): `NavSection { id, label, icon, to, items?: NavLeaf[] }` and `NavLeaf { to, label, icon, badge?: BadgeKey }`. `sectionFor(pathname)` matches the first path segment, `leafFor(pathname)` the longest matching item prefix, and `useNavCounts()` computes every `BadgeKey` count from the store. The rail, SectionTabs, the phone bar, the More sheet and the header title all read from it.

### SectionTabs
Below `xl` the rail cannot show sub-items, so a section's list pages carry its pages as pill tabs at the top of `main`. They render only on a leaf's own path (`pathname === leaf.to`), never on detail pages.
```tsx
<nav aria-label="Quality pages" className="no-scrollbar mb-4 flex max-w-full overflow-x-auto xl:hidden">
  <div className="inline-flex shrink-0 gap-1 rounded-full bg-card p-1 shadow-card">
    <NavLink className={({ isActive }) => cn('inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors',
      isActive ? 'bg-ink text-on-ink' : 'text-muted hover:text-foreground')}>
      Holds <span className="rounded-full px-1.5 text-[11px] font-bold bg-accent-soft text-accent">3</span>  {/* bg-white/20 when active */}
    </NavLink>
  </div>
</nav>
```

### Header
```tsx
<header className="flex h-14 shrink-0 items-center gap-3">
  <Button variant="card" size="icon-lg" className="md:hidden" aria-label="Open menu" onClick={onMenu}><Menu /></Button>
  <div className="hidden min-w-0 shrink-0 md:block md:max-w-[14rem] lg:max-w-[18rem]">
    <h2 className="truncate text-lg font-bold leading-tight">{leaf?.label ?? section.label}</h2>
    <p className="truncate text-xs text-muted">{site.name} · {weekday} {date}</p>
  </div>
  <GlobalSearch className="hidden min-w-0 flex-1 md:ml-4 md:block md:max-w-md" />
  <div className="ml-auto flex shrink-0 items-center gap-2">
    <Button variant="card" size="icon-lg" className="md:hidden" aria-label="Search" aria-expanded={searchOpen} onClick={toggleSearch}><Search /></Button>
    <CreateMenu trigger={<Button className="hidden sm:inline-flex"><Plus />Create</Button>} />
    <NotificationsButton />
    <UserMenu />
  </div>
</header>
{searchOpen && <div className="-mt-2 md:hidden"><GlobalSearch autoFocus onNavigate={closeSearch} /></div>}
```
- The phone menu button opens the More sheet.
- UserMenu is an `ActionMenu` titled `Name · Role` with the trigger `flex h-11 items-center gap-2.5 rounded-full bg-card p-1.5 shadow-card transition-colors hover:bg-surface-2 xl:pr-4`: an `Avatar size="sm"` and, from `xl`, the name `block max-w-[10rem] truncate text-sm font-semibold leading-tight` over the role `block max-w-[10rem] truncate text-[11px] text-muted`. Items: "Switch user" (with a description) and "Sign out".

### Global search
A pill `Input variant="pill" type="search"` with a Search icon and combobox semantics (`role="combobox" aria-expanded aria-controls aria-activedescendant`). The results panel opens below it once the query has text: `absolute inset-x-0 top-full z-40 mt-2 max-h-[60dvh] overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-float`, grouped by entity under kicker headers `px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted`, 5 hits per group, newest first. Hit `flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-surface aria-selected:bg-surface` with a `w-full truncate text-sm font-medium` label (`CODE · name`) over a `w-full truncate text-xs text-muted` hint (status · quantity). Every typed word must match. Arrow keys, Enter and Escape work; hits call `preventDefault` on mouse down so the input keeps focus; the empty state reads `No matches for "query"`. Choosing a hit navigates, clears the query and closes the phone search row.
`⌘K` / Ctrl+K focuses the search from anywhere (below `md` it opens the search row first), and a hint sits in the input's right slot, `kbd hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:inline`. Enter without a highlighted hit opens the main list filtered by the query (`/devices?q=…`).

### Create menu
One `CreateMenu` (an ActionMenu titled "Create") sits behind the rail action, the header button and the phone bar's centre button. Each item is gated by a permission and has an icon, a label and a one-line description ("Manufacturing order · Plan production for a product"). An item either opens a shared create dialog from a provider (`useCreate().manufacturingOrder(preset)`) or navigates to a list with `?new=1` (or `?receive=1`) so the list opens its own dialog. The menu renders nothing when the user can create nothing.

### Notifications
Derive the items from the current state instead of storing them, so an item clears itself when its condition ends. Each item is `{ id, tone, icon, title, body, at, to, mine }`, sorted newest first; `mine` marks items for the user's role.
- Bell: `Button variant="card" size="icon-lg" className="relative"` with the numbered badge (see components) and `aria-label="Notifications, 3 unread"`. Unread means the id is missing from a read list persisted per user and site (`<ns>.admin.read.<user>.<site>`).
- Panel: a Popover `w-[400px] p-0` aligned to the end from `md` up, a light bottom sheet on phones.
- Panel header `flex items-center justify-between gap-3 px-4 pb-2 pt-4`: "Attention required" (`text-base font-semibold`) over `N unread` or "All caught up" (`text-xs text-muted`), and a ghost sm "Mark all read" (disabled at 0).
- Scope toggle `flex gap-2 px-4 pb-2`: sm buttons "For me" and "Site alerts", the selected one `variant="soft"` and the other ghost. Admins start on the site scope.
- List `max-h-[min(70dvh,480px)] overflow-y-auto p-2`; row `flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-surface` (`opacity-70` once read): `IconTile size="sm"` in the item tone, the title `text-sm font-semibold leading-snug` with an unread dot `mt-1.5 size-2 shrink-0 rounded-full bg-accent`, the body `mt-0.5 block text-xs text-muted`, and the time `mt-1 block text-[11px] font-medium text-silver`. Opening a row marks it read, closes the panel and navigates.
- Empty: `EmptyState compact` with BellOff, "Nothing needs attention", and a description that lists what would show up.

### Back navigation and list memory
`BackButton` (ghost sm, ArrowLeft, "Back", `-ml-1 print:hidden`) goes back when `window.history.state.idx > 0` (the user arrived from inside the app) and otherwise navigates to its `fallback` (the list). Lists keep their search, filters and table sort and page per history entry (`useHistoryState(name, initial)`, `useTableHistory()` spread onto DataTable), so Back lands on the list as the user left it. Filters that other pages link to (`?view=at-risk`) live in the URL and update with `replace: true`.

### Breadcrumb trail (deep entity hierarchies)
When detail pages nest (outlet → device → sensor), the top of `main` may carry a trail instead of a lone BackButton: `mb-4 flex min-h-8 items-center gap-3` with the ghost sm BackButton (`-ml-2`), a `h-4 w-px bg-border` divider, and `nav aria-label="Breadcrumb"` holding `ol flex min-w-0 items-center gap-1.5 text-xs text-muted`: `ChevronRight size-3.5 text-silver` separators, a Home icon on the first crumb, entity names as links (`truncate hover:text-foreground hover:underline`), and the current crumb `font-medium text-foreground` with `aria-current="page"`. The dashboard shows none.

## Phone bottom bar (admin)
`BottomBar` with six slots:
1. Home.
2. Role shortcut 1.
3. The round `BottomBarAction` Create, which opens the CreateMenu (a light bottom sheet on phones). A role that can create nothing gets its main tool there instead ("Open station").
4. Role shortcut 2.
5. Role shortcut 3.
6. More, which opens the dark More sheet and stays `active` while it is open.

Shortcuts come from a `Record<Role, [Shortcut, Shortcut, Shortcut]>` map, each `{ label, to, icon, badge? }`, so a planner sees Demand, Schedule and Orders while a quality inspector sees Inspections, Holds and Defects. A slot is active when the path equals its `to` or starts with `${to}/`. `main` gets `pb-24 md:pb-2`. When every role works the same core lists, the shortcuts can be fixed instead (CMMS: Requests with its new-request count, Work orders, Assets).

## Phone "More" menu (dark bottom sheet)
Never a side drawer: a left drawer on a phone covers the screen edge to edge and hides the bar the user tapped. `SheetContent side="bottom" tone="dark" hideClose` with an sr-only title ("All destinations"):
1. Sticky search `sticky top-0 z-10 bg-ink px-4 pb-3 pt-4` holding a label `flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-3` with Search `size-4 text-on-ink-muted` and an input `min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-on-ink-muted` ("Find a page"). A query opens every section and filters pages by page or section label.
2. Recent, shown without a query: a kicker `text-[11px] font-semibold uppercase tracking-wider text-on-ink-muted` over `mt-2 flex flex-wrap gap-2` pills `rounded-full bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20`. It holds the last 4 pages opened from the sheet, persisted (`<ns>.admin.recent-nav`).
3. Sections: the current section first, then the role's preferred sections, then the rest in NAV order. Each is a collapsible header `flex w-full items-center justify-between px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-ink-muted hover:text-white` with a rotating ChevronDown (`aria-expanded`); the current section opens when the sheet opens.
4. An open section is a `grid grid-cols-3 gap-2 px-3 pb-2` of cells `flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors hover:bg-white/10`: tile `relative flex size-11 items-center justify-center rounded-2xl bg-white/10 [&_svg]:size-5` (the current page `bg-accent text-white shadow-glow`), a white count badge at `absolute -right-1 -top-1` (`bg-white text-ink`), and the label `text-xs font-medium leading-tight`.
5. Footer `mt-3 flex items-center gap-3 border-t border-white/10 px-5 pt-4`: Avatar md, the name `truncate text-sm font-semibold` over the role `truncate text-xs text-on-ink-muted`, and `Button variant="onInk" size="sm"` Sign out.

Behaviour: close on backdrop tap, Escape and navigation; record the chosen page in Recent; reset the query and the open section each time the sheet opens; replace the sheet's content instead of stacking a second sheet.
Every other phone menu (row overflow, create, filter, sort, share, notifications, pickers) opens as a light bottom sheet (`bg-card`, handle `bg-border`).

## Print (record pages and labels, CMMS)
A work order or record page must print as a job card, so the shell steps aside on paper:
- Shell `print:block print:h-auto print:overflow-visible print:bg-white print:p-0`; the rail wrapper, header, SectionTabs, bottom bar, glow, BackButton, card header actions and a record's action cluster take `print:hidden`; `main` takes `print:overflow-visible print:p-0`, so the whole record prints instead of one scroll box.
- Cards print with a hairline border instead of the shadow and never split across pages (the Card default carries `print:break-inside-avoid print:border print:border-border print:shadow-none`).
- A print-only caption names the document and the time: `<p className="mb-4 hidden text-xs text-muted print:block">Job card · Factory Bandung · printed 22 Sep 2026 09:41</p>`.
- Printing one element alone (an asset's QR label): portal the printable node onto `body` with `data-print-label`, add `print:[&>*:not([data-print-label])]:hidden` to `body` for the print, and remove it on `afterprint`. Keep that class string literal in the source so Tailwind generates it.
- Offer printing from the record's `…` menu ("Print job card") or from a side card ("Print label"), and check the result in print preview.

## Responsive rules (admin)
Three tiers on Tailwind breakpoints: **phone below `md`** (375 reference), **tablet `md` to below `xl`** (768 and 1024), **desktop from `xl`** (1280).

| Element | Phone | Tablet | Desktop |
|---|---|---|---|
| Nav | floating ink bottom bar (Home, 3 role shortcuts, round Create, More) + dark More sheet | collapsed icon rail `w-[76px]`, no collapse control | rail expandable to `w-60`, preference persisted |
| Section pages | SectionTabs pill row on list pages | SectionTabs | sub-items in the expanded rail; SectionTabs hidden |
| Header | menu · search icon (opens a full-width row under the header, `-mt-2 md:hidden`) · bell · avatar | title block + pill search (`md:max-w-md`) + Create (`sm:inline-flex`) | + name and role beside the avatar (`xl:block`) |
| Canvas padding | `p-3` | `p-3`, `lg:p-4` from 1024 | `lg:p-4` |
| Hero grid | 1 col | 1 col | `xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]` |
| Attention tiles | `grid-cols-2` | `sm:grid-cols-3` | `xl:w-auto` beside the card title |
| Stat rows | `grid-cols-2 gap-3` | `sm:gap-4`; status overview `md:grid-cols-3` | `xl:grid-cols-4`, overview `xl:grid-cols-6` |
| List columns + analysis | stacked | `md:grid-cols-2`, analysis `md:col-span-2` | `xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]`, analysis `xl:col-span-1` |
| Tables | two columns: the identifier (with its phone badge line) and one number | `hideBelow` md and lg columns appear | every column |
| List row status | compact line under the meta (`mt-1.5 flex sm:hidden`) | right column `hidden sm:flex flex-col items-end` | same |
| Record page + side column | stacked | side cards `md:grid-cols-2` | `xl:grid-cols-[minmax(0,1fr)_340px]`, side cards in one column |
| Filters inside a list card (CMMS form) | an outline sm "Filters · N" button opens a bottom sheet (Clear, "Show N results") | the filter row inside the card | same |
| Menus, pickers, notifications | bottom sheets | anchored popovers and dropdowns | same |
| Toasts | centred above the bar (`bottom-24`) | bottom right | bottom right |
| Captions ("updated 09:41", context lines) | `hidden md:block` | shown | shown |

Hard rules
- **`grid-cols-1` base on every breakpoint-only grid.** `grid gap-4 xl:grid-cols-[…]` alone lets the implicit `auto` track grow to the widest `whitespace-nowrap` child, and the page scrolls sideways. Put `minmax(0, …)` around `fr` tracks that hold truncating text.
- Flex rows with a button on the right are `flex flex-wrap items-center justify-between gap-2`, so the button drops below on phones instead of clipping. `CardHeader action` and `PageHeader actions` already wrap.
- Banners: `flex flex-wrap items-center gap-3` with the text at `min-w-[12rem] flex-1`.
- No negative-margin bleed (`-mx-3`) inside the admin `main`: it is a scroll container, and the bleed becomes horizontal scroll. ChipRow, PillTabs and Steps scroll inside their own `max-w-full` box. Bleed rows (`-mx-5 px-5`) belong to the mobile PWA.
- The shell uses `overflow-clip`, and decorative glows sit in their own `overflow-hidden` box.
- Verify at 375 and 768: `document.querySelector('main').scrollWidth === clientWidth`, and no element's `getBoundingClientRect().right > innerWidth` (ignore `overflow-hidden` decor). Use real device emulation; a desktop Chrome window cannot go below about 500px, so a "390px" headless screenshot shows a cropped wider layout.

## Mobile PWA shell (operator or field app)
A separate app in the monorepo (`apps/mobile`), sharing the kit, types and store package, with its own persisted state (`<ns>.mobile.*`).
```tsx
// Tab roots keep the bottom bar; detail screens hide it and show a back button.
<div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
  <main className={cn('flex-1 px-5 pt-[max(env(safe-area-inset-top),0.75rem)]', isTabRoot ? 'pb-32' : 'pb-8')}>
    <Outlet />
  </main>
  {isTabRoot && <TabBar />}
  <ScrollRestoration />
</div>
```
Tab roots are a map from pathname to tab id. Sub-screens reached from More (Alerts, Instructions) count as roots and light the More tab; any other path is a detail screen.
An API-backed PWA holds `<Outlet />` behind the same data states as the admin (components → Data states) and floats its error toast above the tab bar (`bottom-28`).

### TabBar
```tsx
<nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md">
  <div aria-hidden className="pointer-events-none h-8 bg-linear-to-t from-surface to-transparent" />
  <div className="safe-b rounded-t-[28px] bg-card shadow-up">
    <div className="flex items-stretch px-3 pb-2 pt-2">
      {/* per tab */}
      <Link aria-current={active ? 'page' : undefined} aria-label="Work, 3 waiting"
        className="group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-1.5 focus-visible:outline-none">
        <span className={cn('relative flex h-9 w-14 items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-accent/40',
          active ? 'bg-accent-strong text-white shadow-glow' : 'text-muted group-active:bg-surface')}>
          <Icon aria-hidden className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
          <CountBadge count={waiting} className="absolute -right-1 -top-1" />
        </span>
        <span className={cn('text-[11px] font-semibold', active ? 'text-accent-strong' : 'text-muted')}>Work</span>
      </Link>
    </div>
  </div>
</nav>
```
Four tabs (Home, Work, Quality, More). Badges count what waits on the user (work ready to start, inspections pending, active holds on More). The set may follow the role: CMMS gives technicians Home · Work · Scan · Requests and requesters Home · Scan · Requests, and badges count work to start and new requests in the technician's area.

### Screen header (tab roots)
`header flex items-center justify-between gap-3 pt-3`: left `min-w-0` with the context line `truncate text-sm text-muted` ("Good morning · Casting, Pressing") and `h1 mt-0.5 text-[28px] font-bold leading-tight tracking-tight` ending in `<span class="text-accent">.</span>`; right, the avatar `size="lg" ring` as a link to the profile (`rounded-full active:scale-95` + focus ring). CMMS opens the profile as a light bottom sheet from the avatar button instead: a centred `Avatar size="xl" ring`, the name as `SheetTitle mt-3 text-xl font-bold`, the job title, a bare KeyValue (role, team, shift, skills as badges with their level, site) and an outline `size="lg" w-full` Sign out.

### Detail header
`header flex items-center gap-3 pt-3`: a round BackButton `flex size-11 shrink-0 items-center justify-center rounded-full bg-card shadow-card transition-transform active:scale-95` + focus ring (ChevronLeft `size-5`, `aria-label="Back"`), then `min-w-0 flex-1` with the title `truncate text-lg font-bold leading-tight` (a code title uses `text-base font-mono`) over the subtitle `truncate text-xs text-muted`. The back button goes back in history when the user came from inside the app, and otherwise opens the parent tab with `replace` (a scanned link, a reload). The tab bar is hidden.

### Sticky flow header (long guided screens, CMMS)
A record worked through several steps keeps its identity in view with a compact header that sticks and covers the notch: `header sticky top-0 z-30 -mx-5 -mt-[max(env(safe-area-inset-top),0.75rem)] bg-surface/90 px-5 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur`, holding `flex items-center gap-2 pt-3`: the round BackButton; the code `truncate font-mono text-sm font-bold leading-tight` over `truncate text-xs text-muted` (asset · code); a live pill, either the user's running clock `flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-info-soft px-3 text-sm font-bold text-info` with a pulsing `size-2 rounded-full bg-info` dot and the timer, or `bg-warning-soft text-warning text-xs` "Paused"; and a `Button variant="card" size="icon-lg"` EllipsisVertical ActionMenu whose items carry descriptions (Pause work · "Say what you are waiting for", Log time, Open asset).

### Sticky action bar (detail screens)
```tsx
<div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md">
  <div aria-hidden className="pointer-events-none h-6 bg-linear-to-t from-surface to-transparent" />
  <div className="bg-surface px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-1">
    {note && <p role="status" className="mb-2 text-center text-xs font-medium text-muted">{note}</p>}
    <div className="flex gap-2"><Button size="lg" className="h-14 w-full">Record output</Button></div>
  </div>
</div>
```
Pair it with `pb-28` on the page. It holds the one primary action for the record's current state (Start, Record output, Resume, Submit results); the note explains why that action is blocked or what is still missing ("3 characteristics still need a result"). In a guided flow (CMMS) the bar holds an outline `size="lg"` Back (`shrink-0 px-4`) beside the step's primary (`size="lg" flex-1`), the note turns `text-accent` while it names a blocker ("The checklist opens once safety is confirmed") and stays muted for progress ("2 of 5 confirmed"), and the page pads `pb-36` to clear the note.
Frosted variant, for a form that also offers Cancel (a field response): `safe-b fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-5 pb-5` around `flex gap-3 rounded-full bg-white/90 p-2 shadow-float backdrop-blur`, a ghost lg Cancel in `text-accent` (`flex-1`) beside the primary lg submit (`flex-[1.6]`, `loading` while saving).

### Success card (end of a flow, CMMS)
`Card variant="ink" className="p-6"`: a solid `flex size-12 items-center justify-center rounded-2xl bg-success text-white [&_svg]:size-6` Check tile (`strokeWidth={3}`), the title `mt-5 text-xl font-bold leading-tight` ("Work completed", "MR-000284 is on its way"), a body `mt-2 space-y-1 text-sm text-on-ink-muted` whose first line is `font-semibold text-white` and which says who acts next ("Dimas verifies the result on this critical machine next"), then `mt-6 flex flex-col gap-2` of `size="lg" w-full` buttons: the next step as primary ("Open next job") and an `onInk` way out ("Back to my work", "Report another problem"). A teaser for the next item sits inside as `mt-5 rounded-2xl bg-white/5 p-4` under a kicker.

### Action sheet (one operator action)
A bottom `Sheet` with a `SheetHeader` title and one-line `SheetDescription` ("Tell the supervisor why. The order clock keeps running until you resume."), then `div.px-5.pb-2` holding the form, rendered only while open so it resets on close. Forms are `space-y-4`, use `variant="soft"` fields, and end with a full-width `size="lg"` submit that names the action ("Pause", "Record 12", "Consume").

### Section (titled block on a phone screen)
`section.space-y-3` with a header `flex min-h-8 items-center justify-between gap-2`: `h2 flex items-center gap-2 text-base font-bold` plus an optional count pill `rounded-full bg-card px-2 py-0.5 text-xs font-bold text-body tabular-nums shadow-card`, and an optional action, an accent text link sized for touch (`flex h-11 items-center px-1 text-sm font-semibold text-accent`, "All work").

### PWA setup
- `index.html`: `viewport-fit=cover`, `theme-color` ink for the phone app (canvas colour for the admin; CMMS uses the canvas colour on the phone too, because its screen headers sit on the canvas), `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, an `apple-touch-icon.png`, and a meta description.
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`; manifest `display: 'standalone'`, `theme_color` ink, `background_color` surface, SVG icons for `any` and `maskable`; workbox `globPatterns` for js, css, html, svg, png, json and woff2, `navigateFallback: '/index.html'`, a CacheFirst rule for Google Fonts.
- Split the seed data into its own chunk (`manualChunks`: `/packages/fixtures/data/` → `seed`) and raise `maximumFileSizeToCacheInBytes`, so an app update leaves the large seed chunk cached.
- In the app's `index.css`, unlayered: `@media (pointer: coarse) { input, textarea, select { font-size: 16px; } }`, since iOS Safari zooms into any field under 16px.
- Touch targets: at least 44px (`h-11`, `size-11`) for links, tabs, chips and icon buttons; 48px (`min-h-12`, `size-12`) for choice rows and steppers; 56px (`h-14`) for the primary action, keypad keys and measurement inputs.
- A client brand re-draws the icons and chrome: an ink tile, the product glyph in white and an accent + highlight stripe, with `theme-color` and the manifest `theme_color` in the ink (branding.md → App icons).
