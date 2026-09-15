# Page patterns

## Dashboard (admin)
1. Optional banner (info-soft callout) for onboarding / setup.
2. Row: pill view switcher (e.g. Operations | Maintenance) left, `text-xs text-muted` context right.
3. Hero grid `lg:grid-cols-[1.5fr_1fr]`:
   - Left: **dark hero card** (featured entity) — eyebrow, `text-2xl` title, address line, one giant readout (`text-6xl` + unit), pill chips of related items (accent when in alarm), a `bg-white/5` "latest event" row, and a footer of dark chips + Maps/Open buttons.
   - Right column: **accent card** for the single most urgent metric (`text-5xl` number, "Open list" pill button, thin progress bar) above two small stat cards (sparkline / bar strip).
4. Summary strip card (`md:grid-cols-[1.4fr_1fr_1fr_auto]`): segmented health bar + two icon metrics + outline link button.
5. `grid sm:grid-cols-3` of StatCards.
6. `grid xl:grid-cols-[1fr_1fr_0.9fr]`: two list columns (title + count badge + ghost select filter + "View all" outline button, 5 compact items) and an analysis card (donut with legend, date select).

## Gallery page (agents / device types / technicians / integrations)
Page card → header (title + description | search pill + ink primary) → stat tile row (4-up, tinted icon squares) → underline tabs (All · Mine · Templates · Favorites) with Filter/Sort pills → `grid-cols-[repeat(auto-fill,minmax(216px,1fr))]` of entity cards (icon/avatar, name, status chip, role, 2-line description, `SplitStats` footer, kebab + favourite icon buttons top-right, hover lift) → centred "Show more" pill. Optional right inspector column on ≥ xl with setting rows and a "Talk to / Preview" widget card.

## Master data (list → dialog CRUD)
`PageHeader` (search `w-72` + primary "Add X") → `Card` containing `DataTable` (row click opens detail; trailing ghost edit/delete icons) → `XDialog` (`size="lg"`, `grid sm:grid-cols-2 gap-4`, toggles in `rounded-2xl bg-surface px-3 py-2` rows, footer Cancel/Save) → `ConfirmDelete` AlertDialog (title "Delete X?", one-sentence consequence). Empty table → EmptyState with the Add action.
Card-grid alternative (few records, e.g. types): `grid md:grid-cols-2 xl:grid-cols-3`, header with icon tile + count badge + ghost icon actions.

## Detail (admin)
Ghost "← All items" button (+ right-aligned Edit / Remove outline buttons) → `grid lg:grid-cols-2`: identity card (mono id, badges, `KeyValue` dl) and related card (port map / sub-items with add button) → full-width cards for spatial view, history list, tickets. Related rows are `rounded-2xl bg-surface-2 p-3` with hover-revealed actions.

## Alerts / activity list (admin)
Underline or pill tabs (Open / Responded / Cleared with counts) → filters row (select + search) → card with rows; selecting a row opens a **right Sheet** with a dark hero header, key/values, response block (avatar + notes + photo grid) and actions.

## Mobile list screen
Header → horizontal chip filter (`All` + entities) → segmented pill tabs with counts (urgent tab accent) → `space-y-3` of mobile cards, **6 per page with lazy-load sentinel** → EmptyState per tab. Never render three stacked sections; one list at a time.

## Mobile detail screen
Round back button header → **dark hero card** (`rounded-[28px] bg-ink p-6 shadow-float`, accent blob, icon tile top-left, status badge top-right, `text-xl` message, `text-[44px]` value, muted "ongoing for") → key/value dl card → info-soft card for existing response (avatar, notes, 3-col photo grid) → form card (`rounded-[24px] bg-card p-5`: `text-base font-bold` title, muted helper, textarea `border-0 bg-surface`, photo dropzone `rounded-2xl bg-surface` with camera/browse buttons) → primary `size lg w-full` submit + ghost cancel; success state = ink card with green check tile.

## Mobile hub screen (e.g. maintenance)
Header → 3 stat tiles (ink / accent / card) → full-width primary CTA (if the user can create) → horizontal-scroll card rail (`-mx-5 px-5 flex gap-3 overflow-x-auto`, `w-44` cards, tone by status) → section with pill filter (`Mine | All | Done`) + lazy list → info-soft link card.

## Spatial / shopfloor view
`xl:grid-cols-[1fr_1.15fr]`: left = map card (fixed height, legend row, count) + searchable list card with All/With alerts/Offline chips; right = selected entity card (mono code, title, address, Maps/Open buttons, floor plan with markers, legend) + detail card that swaps between device / sensor / list of units. Selection via URL param.

## Setup wizard
Centered `max-w-5xl`: wordmark + title + "Skip" ghost → 6-step pill stepper (`grid grid-cols-6 gap-2`, current `bg-ink`, done white with green check tile, upcoming `bg-surface-2 text-muted`) → one card per step (`p-6`, `text-lg font-bold` question, `grid sm:grid-cols-2 gap-4` fields or editable rows `rounded-2xl bg-surface p-3`) → Back (outline) / Continue (primary) row → final card with green check, summary sentence, three buttons.

## Integration / settings console
Mode card (ink or accent full-width with a select on the right) + 3 small stat cards → pill tabs → channel cards (`flex items-start gap-4 p-5`: icon tile, title + badge, description, Test outline button + Toggle) beside settings cards (`grid sm:grid-cols-2`) → console (textarea `font-mono text-xs min-h-72`, Parse secondary + Ingest primary, result `pre rounded-2xl bg-ink p-4 text-xs text-white`) → log rows (`flex items-center gap-3 px-5 py-3` with direction tile, time, channel badge, mono path, summary, status badge, ms).

## Checklist before finishing a screen
- [ ] Exactly one accent element per region; dark ink used for the second emphasis.
- [ ] Every card `rounded-card bg-card shadow-card`, no borders; canvas is `surface`.
- [ ] All controls are pills; icons lucide `size-4`/`size-5`; icon tiles round.
- [ ] Mobile title ends with the accent period; avatar top-right; tab bar hidden on detail.
- [ ] Lists on mobile are tabbed and lazy-loaded (6 per page); tables on admin paginate.
- [ ] Numbers big + unit muted beside them; identifiers mono.
- [ ] Every data-backed dropdown is searchable (search row, keyboard nav, no-matches state); plain selects only for fixed enums of 6 or fewer options.
- [ ] Empty states have a title, description and next action; every button works.
- [ ] Hover = surface/white-10, press = scale 0.98, focus = accent ring; nothing else animates except live-alarm pulse.
- [ ] Responsive: every breakpoint-only grid has a `grid-cols-1` base; header/banner/card-header rows wrap; checked at 375 (drawer, icon search, snap stat row, compact list rows) and 768 (icon rail, paired columns) with `main.scrollWidth === main.clientWidth`.
