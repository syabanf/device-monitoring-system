# Component recipes (Tailwind v4, semantic tokens from tokens.css)

Stack assumed: React + Tailwind v4 + Radix primitives + lucide-react (stroke 2) + cva for variants.
Class strings below are the source of truth; adapt to other frameworks by keeping the same numbers.

## Button
base: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`
- primary: `bg-accent text-white shadow-glow hover:bg-accent-strong`
- secondary: `bg-ink text-on-ink hover:bg-ink-3`
- outline: `border border-border bg-card text-foreground hover:bg-surface`
- ghost: `text-foreground hover:bg-black/5`
- link: `text-accent underline-offset-4 hover:underline`
- sizes: sm `h-8 px-3 text-xs` · md `h-10 px-4` · lg `h-12 px-6 text-base` · icon `size-10`
- loading: swap first icon for `Loader2 animate-spin`, disable.
- round white utility button (topbar / mobile back): `size-11 rounded-full bg-card shadow-card` (ghost icon).

## Card
`rounded-card bg-card shadow-card` · header `flex flex-col gap-1 p-5` · title `text-base font-semibold leading-tight` · description `text-sm text-muted` · content `p-5 pt-0` · footer `flex items-center p-5 pt-0`.
Header with actions: `flex-row items-start justify-between space-y-0`.
Dark hero: `relative overflow-hidden bg-ink text-on-ink` + blob `pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/30 blur-3xl`; secondary text `text-on-ink-muted`; inner panels `rounded-2xl bg-white/5 hover:bg-white/10`; chips on dark `border-white/10 bg-white/10 text-white`.
Accent card (the one urgent thing): `bg-accent text-white`, progress bar `h-1.5 rounded-full bg-white/25` with `bg-white` fill.

## StatCard
Label / value / hint on the left, a **soft-tinted square icon tile** on the right:
```html
<div class="flex items-start gap-3 rounded-card bg-card p-5 shadow-card">
  <div class="min-w-0 flex-1">
    <p class="text-[13px] font-semibold text-body/80">Avg response time</p>
    <p class="mt-1.5 truncate text-[28px] font-extrabold leading-[1.15] tracking-[-0.5px]">30m</p>
    <p class="mt-1 text-xs text-muted">Last 7 days</p>
  </div>
  <div class="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] bg-success-soft text-success [&_svg]:size-[18px]"><Clock /></div>
</div>
```
Tones are **tints**, never solid fills: `default` `bg-surface text-body` · `danger` `bg-accent-soft text-accent` · `success` `bg-success-soft text-success` · `warning` `bg-warning-soft text-warning` · `info` `bg-info-soft text-info` · `ink` `bg-ink text-on-ink` (reserve the solid ink tile for the single primary stat on a screen).
Rows: `grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4`, or a phone snap row (see layouts → Responsive rules).
Mobile PWA stat tile (3-up, different component): `rounded-[24px] px-4 py-5 shadow-card`, number `text-[32px] font-bold leading-none`, label `mt-2 text-xs font-medium`; tones ink / accent / card.

## Readout (sensor value)
label `text-xs font-medium text-muted`; value `text-4xl font-bold tracking-tight` with unit `pt-1 text-sm font-semibold text-muted` in a `flex items-start gap-1 leading-none`.

## Badge
`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap`
variants: default `bg-surface text-body` · accent `bg-accent text-white` · success `bg-success-soft text-success` · warning `bg-warning-soft text-warning` · danger `bg-danger-soft text-danger` · info `bg-info-soft text-info` · muted `bg-surface text-muted` · outline `border border-border text-foreground`. Optional dot `size-1.5 rounded-full`.
Count badge on nav/tab: `flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ring-2 ring-card`.

## Input / Textarea / FormField
input: `h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-surface`; left icon `absolute left-3 text-muted [&_svg]:size-4` + `pl-10`; right slot `pr-11`; error `border-danger`.
textarea: same, `min-h-28 py-3`. Inside a white card: `border-0 bg-surface`.
search pill: `[&_input]:h-11 [&_input]:rounded-full [&_input]:border-0 [&_input]:bg-card [&_input]:shadow-card`.
label `mb-1.5 block text-sm font-medium`; hint `mt-1 text-xs text-muted`; error `mt-1 text-xs text-danger`.
See **Select / Combobox** below for dropdown fields.

## Select / Combobox (searchable by default)
**Every dropdown is a searchable combobox.** The only exception is a fixed enum of 6 or fewer values that will never grow (status, priority, mode, provider). Anything backed by data (outlets, devices, sensors, employees, technicians, models, time zones, tags) gets a search row even when it holds three rows today, because the list grows in production.

trigger, shaped like an input so forms stay aligned: `flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 text-sm` plus `<ChevronDown class="size-4 shrink-0 opacity-60" />`; placeholder `text-muted`, value `truncate`; inside a white card `border-0 bg-surface`; inline filter variant `h-8 rounded-full px-3 font-medium hover:bg-black/5`.

panel (popover, `min-w-[var(--radix-popover-trigger-width)]`, `overflow-hidden rounded-2xl border border-border bg-card shadow-float`):
1. search row `flex h-11 items-center gap-2 border-b border-border px-3` with `<Search class="size-4 text-muted" />` and `input.h-full.flex-1.bg-transparent.text-sm.outline-none.placeholder:text-muted`, focused on open.
2. list `max-h-64 overflow-y-auto p-1`; option `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface aria-selected:bg-surface`, secondary line `text-xs text-muted` (code, serial, outlet), selected row ends with `<Check class="ml-auto size-4 text-accent" />`.
3. empty state `px-3 py-6 text-center text-sm text-muted` quoting the typed query.
4. optional footer `border-t border-border p-1` holding a `text-accent font-semibold` create row when the user may add a record.

behaviour: filter case-insensitively across the label and every secondary field; keep the selected option visible while the query is empty; arrow keys move the highlight, Enter picks, Escape closes and restores the previous value; clear the query on close; show `N of M` in the search row once M passes 20; optional fields get a Clear row at the top of the list.

a11y: trigger `role="combobox" aria-expanded aria-controls`, list `role="listbox"`, rows `role="option" aria-selected`, `aria-activedescendant` tracks the highlight, and the search input inherits the field label.

mobile: below `md` render the same panel as a bottom sheet (`rounded-t-[28px] max-h-[70dvh]`, search row pinned) so the keyboard never covers the list.

build: Radix Popover plus cmdk, or Radix Select with a filter input pinned above the viewport. Multi-select reuses the panel with checkboxes and shows chips in the trigger.

## Tabs
pill list: `w-fit flex items-center gap-1 rounded-full bg-card p-1 shadow-card`; trigger `rounded-full px-4 py-1.5 text-sm font-medium text-muted hover:text-foreground data-[state=active]:bg-ink data-[state=active]:text-on-ink`.
underline list: `w-full overflow-x-auto border-b border-border`; trigger `-mb-px border-b-2 border-transparent px-4 py-2.5 text-muted data-[state=active]:border-accent data-[state=active]:text-foreground`.
mobile segmented (equal width, with counts): container `flex gap-1 rounded-full bg-card p-1 shadow-card`; button `flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold`; active urgent tab `bg-accent text-white`, other active `bg-ink text-on-ink`; count pill `rounded-full px-1.5 text-[10px]` (`bg-white/20` when active, `bg-surface` otherwise).

## Chip / filter row
chip: `inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-xs font-semibold text-body hover:bg-surface data-[active=true]:border-accent data-[active=true]:bg-accent data-[active=true]:text-white [&_svg]:size-4`; icon-only `w-10 px-0`.
scrolling filter row (mobile): `-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]`; selected `bg-ink text-on-ink`, others `bg-card text-body shadow-card`, `h-10 shrink-0 rounded-full px-4 text-sm font-semibold`.
view switcher (admin): `inline-flex rounded-full bg-card p-1 shadow-card` with `h-9 px-4 text-sm font-semibold` buttons, active `bg-ink text-on-ink`.

## Toggle
`relative inline-flex h-7 w-12 items-center rounded-full transition-colors` · on `bg-accent` · off `bg-silver/60`; knob `absolute left-0.5 size-6 rounded-full bg-white shadow-sm` + `translate-x-5` when on.

## Avatar
`inline-flex items-center justify-center rounded-full font-semibold text-white` with per-user background colour; sizes sm `size-7 text-[10px]`, md `size-9 text-xs`, lg `size-12 text-sm`, xl `size-20 text-2xl`. Header avatar adds `shadow-card ring-4 ring-card`.

## Table (DataTable)
wrapper card; th `h-10 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted` (sortable header is a button with chevrons); td `px-4 py-3 align-middle`; row `border-b border-border data-[clickable=true]:cursor-pointer hover:bg-surface-2`; empty → EmptyState in a full-width cell; pagination `flex items-center justify-between border-t px-4 py-3 text-sm text-muted` with two `size-8` outline icon buttons and `Page x / y`.
Row actions column: `flex justify-end gap-1` of ghost `size-8` icon buttons (edit, delete in `text-accent`), `onClick stopPropagation`.

## List item (admin compact) / Mobile card
mobile card: `block rounded-[24px] bg-card p-4 shadow-card transition-transform active:scale-[0.98]`; leading tile `flex size-12 shrink-0 items-center justify-center rounded-full` (urgent `bg-accent text-white`, info `bg-info-soft text-info`, resolved `bg-surface text-muted`); title row `flex items-center justify-between` with `text-[13px] font-semibold` and status `text-[11px] font-semibold` + `size-1.5` dot; subtitle `mt-0.5 truncate text-[13px] text-muted`; message `mt-3 text-[15px] font-semibold leading-snug`; footer `mt-2.5 flex justify-between` (value `text-sm font-bold tabular-nums`, "New" marker `text-[11px] font-semibold text-accent` with `size-2` dot). Resolved items `bg-card/70`.
admin row item: `flex items-center gap-3 rounded-2xl bg-surface-2 p-3 hover:bg-card hover:shadow-card`; selected `bg-ink text-on-ink`.

## Key/value sheet
`dl` `divide-y divide-border rounded-[24px] bg-card px-5 py-1 shadow-card`; row `grid grid-cols-[96px_1fr] gap-3 py-3.5 text-sm` (admin `grid-cols-[120px_1fr] py-2`), `dt text-muted`, `dd min-w-0 break-words`.

## EmptyState
`flex flex-col items-center justify-center gap-2 px-6 py-12 text-center`; icon tile `size-12 rounded-full bg-surface text-muted [&_svg]:size-6`; title `text-sm font-semibold`; description `max-w-xs text-sm text-muted`.

## Dialog / Sheet / AlertDialog
overlay `fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]` (fade in/out).
dialog `fixed left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-card bg-card p-6 shadow-float` sizes `max-w-sm / max-w-lg / max-w-2xl`; header `mb-4 pr-6`, title `text-lg font-semibold`, description `text-sm text-muted`; footer `mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end` (outline Cancel, primary Submit); close = `absolute right-4 top-4 p-1 text-muted`.
sheet right `inset-y-0 right-0 w-full max-w-xl border-l` (slide-in, detail panels on tablet and up).
bottom sheet `inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),1rem)]` with a grab handle `mx-auto mt-3 h-1.5 w-10 rounded-full bg-border`; dark variant `bg-ink text-on-ink` with handle `bg-white/20` for navigation.
**On phones every menu is a bottom sheet**: the bottom bar "More" list, row overflow menus, filters, sort, share, and action lists. Side drawers are for tablet and up only, and the searchable combobox panel follows the same rule.
alert dialog `max-w-md`, action = destructive-styled button (`bg-danger text-white`), cancel = outline.

## Banner / callout
`flex items-center gap-3 rounded-card bg-info-soft px-4 py-3`; icon tile `flex size-9 items-center justify-center rounded-full bg-card text-info`; text `text-sm` with `font-semibold` lead-in and `text-body/70` copy; small primary button; ghost `size-8` dismiss.
Soft info section (mobile): `rounded-[24px] bg-info-soft p-5`.

## Lazy list (mobile)
hook: reveal `pageSize` (6) more on demand; reset only on an explicit key (tab/filter), not on array identity.
sentinel: `flex items-center justify-center gap-2 py-4 text-xs text-muted` → `Loader2 animate-spin` + "Loading more…" while busy, otherwise "N more" + `font-semibold text-accent` "Load" button; IntersectionObserver `rootMargin 120px`.

## Floor plan / map markers (if a spatial view exists)
marker: `absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full ring-2 ring-card shadow-float`; device marker `rounded-2xl`; states normal `bg-ink text-white`, alarm `bg-accent text-white animate-pulse`, offline `bg-silver`, fault `bg-warning-soft text-ink`, muted `bg-card text-muted ring-border`; selected `scale-125 ring-4 ring-accent/40`.


## Split-stat footer
```tsx
<div class="-mx-5 -mb-5 mt-auto grid grid-cols-2 divide-x divide-border border-t border-border">
  <div class="px-2 py-3 text-center"><span class="block text-[10.5px] font-medium text-muted">Conversations</span><span class="block text-[15px] font-extrabold tabular-nums">423</span></div>
  …
</div>
```
Place as the last child of `CardContent` so it sits flush with the card edge. 2–4 cells.

## Inspector row list (right column)
Card with small-caps title (`text-[13px] font-bold uppercase tracking-[0.4px]`) and a close/×; rows are `rounded-2xl border border-border p-3.5 flex items-center gap-3 hover:bg-surface-2`: icon tile `size-9 rounded-xl bg-surface`, `text-sm font-bold` title + `text-xs text-muted` subtitle, chevron right; an accent dot on the row marks unsaved changes. Below: outline full-width primary ("Preview") and a `text-accent text-sm font-semibold` danger link ("Delete").

## Underline tabs + filter pills
`div.flex.items-end.gap-3.flex-wrap` → `div.flex.flex-1.gap-6.border-b.border-border.overflow-x-auto` of `button.py-3.text-sm.font-semibold.text-muted.border-b-2.border-transparent.-mb-px.whitespace-nowrap` (active `text-accent border-accent`) + right-side outline pills `h-10 rounded-full border bg-card px-4 text-sm font-semibold` ("Filter", "Sort"). Use inside a page card above a card grid; pill tabs remain the choice for view switches.

## Page card + "Show more"
Wrap a gallery page in one `rounded-card bg-card p-6 shadow-card`: header row (`h2 text-[29px] font-extrabold tracking-[-1px]` + `p text-sm text-body/70 max-w-[30rem]`, actions right: search pill + ink primary), stat tile row, underline tabs, the grid, then a centred outline pill "Show more ▾" that reveals the next page.

## Rail action / workspace card
`RailAction`: `size-11 rounded-full bg-accent text-on-ink shadow-[0_6px_18px_accent/45] hover:-translate-y-px hover:scale-105`. `RailWorkspace` (expanded): `flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-ink-2 p-2.5` with `size-9 rounded-xl bg-card text-ink` tile, kicker `text-[10.5px] font-semibold text-on-ink-muted`, name `text-[12.5px] font-bold`, caret; collapsed → the tile alone.

