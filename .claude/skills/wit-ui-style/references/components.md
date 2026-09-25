# Component recipes (Tailwind v4, semantic tokens from tokens.css)

Stack: React 19 + Tailwind v4 + `radix-ui` (the unified package: `import { Dialog as DialogPrimitive } from 'radix-ui'`) + lucide-react (stroke 2) + class-variance-authority + clsx + tailwind-merge.
The class strings below are the source of truth. In another framework, keep the numbers.

## Shared foundations
- `cn()` is `twMerge(clsx(...))` built with `extendTailwindMerge({ extend: { theme: { radius: ['card', 'hero', 'pill'], shadow: ['card', 'float', 'glow', 'up'] } } })`. Without the extension, `rounded-card` and `rounded-2xl` both survive a merge.
- Focus ring on every interactive element: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`. Fields use `focus:border-accent focus:ring-2 focus:ring-accent/20`. On a coloured ink (branding.md), where accent/40 fades, add the strong ring from tokens.css (a white outline plus an ink ring) on top of these classes.
- Colours come from tokens, never literals: glows use `shadow-glow`, tints use token opacity (`bg-accent/30`), and code a class cannot reach (chart libraries, map markers, hand-drawn SVG, inline `style`) reads the `BRAND` hex mirror in `lib/brand.ts`. A literal rgb or hex keeps the old palette after a rebrand.
- Press: `active:scale-[0.98]` on tappable cards, buttons and chips; round header buttons use `active:scale-95`.
- Icon size comes from the parent: `[&_svg]:size-4 [&_svg]:shrink-0` in buttons and chips, `[&_svg]:size-5` in the rail, the bar and large tiles.
- Overlay for Dialog, Sheet and ConfirmDialog: `fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0`.
- Close button: `absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full transition-colors [&_svg]:size-4` + focus ring, then `text-muted hover:bg-surface hover:text-foreground` (light) or `text-on-ink-muted hover:bg-white/10 hover:text-white` (dark).
- `useIsPhone()` is `useMediaQuery('(max-width: 767.98px)')` on `useSyncExternalStore`. Menus, pickers and the notification panel switch from an anchored popover to a bottom sheet below `md` with it.
- Roving tabindex for tab lists and radio groups: arrow keys move and select, Home and End jump, disabled entries are skipped, the list wraps, one element sits in the tab order.
- `sameKey(a, b)` compares reset keys and treats arrays by value, so `resetKey={[tab, filter]}` works inline.

## Button
base `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`

| variant | classes | use |
|---|---|---|
| primary | `bg-accent-strong text-white shadow-glow hover:bg-accent-dark` | the one main action in a region |
| secondary | `bg-ink text-on-ink hover:bg-ink-3` | the second emphasis |
| outline | `border border-border bg-card text-foreground hover:bg-surface` | Cancel, "View all", secondary actions |
| ghost | `text-foreground hover:bg-black/5` | Back, Clear, tertiary actions |
| link | `text-accent-strong underline-offset-4 hover:underline` | inline links |
| danger | `bg-danger-soft text-accent-strong hover:bg-accent-strong hover:text-white` | a destructive action that opens no confirm |
| card | `bg-card text-foreground shadow-card hover:bg-surface` | round white utility buttons on the canvas (menu, search, bell), phone secondary actions |
| soft | `bg-surface text-foreground hover:bg-surface-2` | actions inside a white card, the selected option in a row of ghost toggles |
| onInk | `bg-white/10 text-white hover:bg-white/20` | any button on an ink or accent surface |

sizes: sm `h-8 px-3 text-xs` · md `h-10 px-4` · lg `h-12 px-6 text-base` · icon `size-10` · icon-sm `size-8` · icon-lg `size-11`.
`loading` disables the button, sets `aria-busy` and swaps the first icon child for `LoaderCircle animate-spin` (it prepends one when there is no icon).
`asChild` (Radix Slot) styles a router link: `<Button asChild variant="outline" size="sm"><Link to="…">View all</Link></Button>`.
Operator screens use `size="lg"` and raise the single primary to `h-14 w-full`.

## Card
`Card` variants:
- default `rounded-card bg-card shadow-card`, plus `print:break-inside-avoid print:border print:border-border print:shadow-none` so on paper a hairline border replaces the shadow and a card never splits across pages (CMMS)
- ink `relative isolate overflow-hidden rounded-hero bg-ink text-on-ink shadow-float`. The card draws its own blob, `pointer-events-none absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-accent/30 blur-3xl`; `isolate` keeps `-z-10` behind the content and above the ink. Do not add a second blob by hand.
- accent `rounded-card bg-accent text-white shadow-glow`, for the one urgent metric on a screen
- soft `rounded-2xl bg-surface-2`, a nested panel with no shadow

CardHeader `flex flex-col gap-1 p-5`. With the `action` prop it becomes `flex flex-wrap items-start justify-between gap-2 p-5` with the title column `flex min-w-0 flex-1 flex-col gap-1` and the actions `flex min-w-0 max-w-full flex-wrap items-center gap-2`, so actions wrap under the title on phones instead of clipping. Give the actions slot `print:hidden` so buttons stay off paper.
CardTitle `text-base font-semibold leading-tight` · CardDescription `text-sm text-muted` · CardContent `p-5 pt-0` · CardFooter `flex items-center p-5 pt-0`. A card holding one block drops the header: `<Card className="p-5">`, or `p-4` for a strip.
A title with a count: `<CardTitle className="flex items-center gap-2">Running work orders <CountBadge count={n} /></CardTitle>`.
Heading levels: PageHeader renders the page's `h1` (an `sr-only` one on a dashboard that shows no title), CardTitle the level under it (`h2` in CMMS), and headings inside a card start one level lower, so no level is skipped.

On ink: secondary text `text-on-ink-muted`; inner panels `rounded-2xl bg-white/5 p-3` (hover `bg-white/10`); chips `border-white/10 bg-white/10 text-white`; buttons `variant="onInk"`; status notes `rounded-2xl bg-accent/20 px-3 py-2 text-sm` (risk, hold) or `bg-warning/20` (paused); progress `h-1.5 rounded-full bg-white/15` with a `bg-white` fill. An EmptyState inside an ink card takes `className="text-on-ink [&_p]:text-on-ink-muted"`.
On accent: label `text-[13px] font-semibold text-white/80`, number `text-5xl font-bold leading-none tracking-tight tabular-nums`, context `text-sm text-white/80`, progress `h-1.5 rounded-full bg-white/25` with `bg-white`, button `variant="onInk" size="sm"`.
On a coloured ink (a brand blue) the accent disappears as text or an icon (Indomaret red on its blue measures 1.09:1): keep accent there to solid fills with white content, and give an accent period on ink the `highlight` colour or white.
Nested card: a gauge card or a record card placed inside a sheet or another card takes `bg-surface shadow-none` (`bg-surface-2 shadow-none` inside a white card).
Stretched-link card (a gallery card that opens its record, CMMS): `Card className="relative flex flex-col p-5 transition-colors hover:bg-surface-2"`, and the title link carries `after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent/40`. The whole card clicks through a real link, while buttons inside it stay separate controls.

## BrandMark (client logo)
The client's logo as an `<img>` imported from the kit's `assets/` (the bundler content-hashes it; an `assets.d.ts` declares the module), with `width`, `height`, `alt` (the brand name) and `draggable={false}`: `block h-auto shrink-0 select-none`, `w-36` by default, `w-9` when `compact`.
- On white, the bare image: `w-36` on a phone login, `w-28` in a wizard header.
- On ink, `plate` sets it on a white tile, `inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-card`, because a logo's own colours can vanish into a coloured ink: rail header `[&_img]:w-24`, collapsed rail `compact` inside a `size-11 p-1` plate, sign-in hero `[&_img]:w-40`.
The file, the app icons and the stand-in wordmark: branding.md.

## IconTile
`flex shrink-0 items-center justify-center [&_svg]:shrink-0` + tone + size + shape.
tones: default `bg-surface text-body` · danger `bg-accent-soft text-accent` · success `bg-success-soft text-success` · warning `bg-warning-soft text-warning` · info `bg-info-soft text-info` · ink `bg-ink text-on-ink` · accent `bg-accent text-white`. Ink and accent are the only solid fills.
sizes: sm `size-9 rounded-xl [&_svg]:size-4` · md `size-[42px] rounded-[13px] [&_svg]:size-[18px]` · lg `size-12 rounded-2xl [&_svg]:size-5`; `shape="round"` adds `rounded-full`.
A tile may hold a number instead of an icon (an operation sequence): `className="text-base font-bold tabular-nums"`.
One `Tone` union (`default | danger | success | warning | info | ink | accent`) feeds IconTile, StatCard, StatusDot and every status-to-tone map.

## StatCard
```html
<div class="flex flex-col rounded-card bg-card p-5 text-left shadow-card">
  <div class="flex w-full items-start gap-3">
    <div class="min-w-0 flex-1">
      <div class="text-[13px] font-semibold text-body/80">Downtime today</div>
      <div class="mt-1.5 flex items-start gap-1">
        <span class="truncate text-[28px] font-extrabold leading-[1.15] tracking-[-0.5px]">95</span>
        <span class="shrink-0 pt-1.5 text-sm font-semibold text-muted">min</span>
      </div>
      <div class="mt-1 text-xs text-muted">4 OEE snapshots</div>
    </div>
    <IconTile tone="warning"><Wrench /></IconTile>
  </div>
  <!-- optional children (sparkline, bar strip) in "mt-4 w-full" -->
</div>
```
With `onClick` the card renders as a `<button>` and adds `w-full transition-colors hover:bg-surface-2 active:scale-[0.98]` + focus ring. List pages make their stat tiles clickable so each applies its filter (`?view=at-risk`).
The tone follows the number: `tone={count ? 'danger' : 'success'}`, `tone={delayed ? 'warning' : 'default'}`, and `ink` for the one primary stat in a row.
Rows: `grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4`; a status overview row `grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6`.

## Badge, CountBadge, StatusDot
Badge `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0`, optional dot `size-1.5 shrink-0 rounded-full bg-current`.
variants: default `bg-surface text-body` · accent `bg-accent-strong text-white` · success `bg-success-soft text-success` · warning `bg-warning-soft text-warning` · danger `bg-danger-soft text-accent-strong` · info `bg-info-soft text-info` · muted `bg-surface text-muted` · outline `border border-border text-foreground` · ink `bg-ink text-on-ink`.
Default and muted badges share the canvas colour, so on a table that sits on the canvas they read as plain text. Keep that for low-emphasis states.

Status badges: one component per status union in `components/badges.tsx`, each built as `Record<Status, Variant>` + `<Badge variant={X_VARIANT[s]}>{X_LABEL[s]}</Badge>`.

| state kind | variant |
|---|---|
| draft, open, undecided (a null disposition reads "Pending") | outline |
| planned, ready, idle | default |
| released, assigned, confirmed, committed | ink |
| in progress, fulfilling | info |
| in review, paused, on hold (resumable), partial | warning |
| failed, rejected, shortage, blocked by a quality hold | danger |
| completed, passed, ready to ship | success |
| the one "act now" value: critical priority, an open NCR, a machine that is down | accent |
| closed, cancelled, obsolete, waiting | muted |

`dot` marks live or blocked states (in progress, paused, on hold) and every severity and machine-state value. Priority: critical `accent`, high `danger`, normal `default`, low `muted`. A released, locked document shows a muted badge with a Lock icon ("Released").
An operator app whose screen is about one running job may promote "in progress" to `accent`. On ink, a badge swaps to `bg-white/10 text-white` unless it is accent.

CountBadge (nav and tab counters) renders nothing at 0 and caps at `99+`: `inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums ring-2` + accent `bg-accent-strong text-white ring-card` or white `bg-white text-ink ring-ink` (on the ink rail and bar). On icon tiles it sits at `absolute -right-1 -top-1`.
Header bell badge (on the canvas): `absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-accent px-1 text-[10.5px] font-bold text-on-ink`.
StatusDot `inline-block size-2 shrink-0 rounded-full` + tone (`bg-silver` default, `bg-accent`, `bg-success`, `bg-warning`, `bg-info`, `bg-ink`), optional `animate-pulse`; give it `role="img" aria-label` when no text sits beside it.
StatusText (status line on a mobile card): `flex shrink-0 items-center gap-1.5 text-[11px] font-semibold` in the tone's text colour + a `size-1.5` StatusDot that pulses on the accent tone.

## Input / Textarea / NativeSelect / FormField
Input base `h-11 w-full min-w-0 px-4 text-base text-foreground md:text-sm transition-colors placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60`. The 16px phone size stops iOS from zooming into the field.
variants:
- default `rounded-2xl border border-border bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-surface`
- soft `rounded-2xl border-0 bg-surface focus:ring-2 focus:ring-accent/20`, inside white cards and sheets
- pill `rounded-full border-0 bg-card shadow-card focus:ring-2 focus:ring-accent/20`, for search on the canvas

Left icon `pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 text-muted [&_svg]:size-4` + `pl-10` on the input; right slot (unit, clear button) `absolute right-2 top-1/2 flex -translate-y-1/2 items-center text-muted` + `pr-11`. `className` styles the wrapper and `inputClassName` the input: `h-12` for login fields, `h-12 text-lg font-semibold tabular-nums` for a quantity, `h-14 text-xl font-bold tabular-nums` with the unit in the right slot for a measurement.
Phone field settings (CMMS): a code typed from a tag takes `autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="go"` and `inputClassName="h-12 font-mono uppercase"`, with its error in a `role="alert"` line that names the code and the site; a reading takes `inputMode="decimal" enterKeyHint="done"`, commits on blur, and Enter blurs it. A search inside a white card is `variant="soft" inputClassName="rounded-full"` with the Search icon.
Invalid: the default variant turns `border-danger focus:border-danger`; soft and pill add `ring-2 ring-danger/25`. Set `aria-invalid`.
Textarea `min-h-28 rounded-2xl px-4 py-3` + the same text and focus classes; default `border border-border bg-card focus:border-accent disabled:bg-surface`, soft `border-0 bg-surface`. Short notes take `className="min-h-20"`.
NativeSelect, for fixed enums of 6 or fewer values: `cursor-pointer appearance-none text-base md:text-sm` + default `h-11 w-full rounded-2xl border border-border bg-card pl-4 pr-10`, soft `h-11 w-full rounded-2xl border-0 bg-surface pl-4 pr-10`, or inline `h-8 rounded-full bg-transparent pl-3 pr-8 font-medium hover:bg-black/5`; chevron `pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 opacity-60` (inline `right-2.5`); an empty value renders `text-muted`.
FormField `flex min-w-0 flex-col`: label `mb-1.5 block text-sm font-medium text-foreground` with a required mark `ml-0.5 text-accent` "*"; message `mt-1 text-xs`, `text-danger` for an error and `text-muted` for a hint, and the error replaces the hint. FormField hands the control its id, `aria-describedby` and invalid state through context, so Input, Textarea, NativeSelect, Combobox and Switch need no manual wiring.
Validation: show errors after the first submit (a `tried` flag), not while the user types. Long forms keep submit enabled so the first press reveals what is missing; short sheet forms disable submit until the input is valid.

## Select / Combobox (searchable by default)
**Every dropdown is a searchable combobox.** The one exception is a fixed enum of 6 or fewer values that will never grow (status, priority, mode, disposition). Anything backed by data gets a search row even while it holds three rows.
API: `Combobox<T>` takes `items, getKey, getLabel, getDescription?, getKeywords?, renderIcon?, getDisabledReason?, value, onChange, clearable?, placeholder, searchPlaceholder, emptyText, variant, createLabel?, onCreate?`; `MultiCombobox<T>` takes `values` and `onChange(values)`. Wrap each entity in a named picker (`ProductPicker`, `LotPicker`, `ReasonPicker kind="hold"`) that fixes the getters, drops inactive records and writes the secondary line (`code · category`, `42 left · Rack B · available`).
Trigger variants: default `h-11 w-full rounded-2xl border border-border bg-card px-4 data-[state=open]:border-accent` · soft `h-11 w-full rounded-2xl bg-surface px-4` · inline `h-8 max-w-full rounded-full px-3 font-medium hover:bg-black/5 data-[state=open]:bg-black/5` for filter bars. Shared: `flex min-w-0 items-center gap-2 text-left text-sm`, `<ChevronDown class="size-4 shrink-0 opacity-60" />`, placeholder `truncate text-muted`, optional leading icon (an avatar at `size="xs"`).
Multi trigger: up to 3 chips `inline-flex h-6 max-w-[10rem] items-center rounded-full px-2 text-xs font-medium` (`bg-surface`, or `bg-card` in the soft variant) then `+N`; the inline variant shows the first label and `+N`.
Panel from `md` up: a `modal` Radix Popover (so the list scrolls inside a Dialog), `align="start" sideOffset={6} collisionPadding={12}`, `z-50 flex w-72 min-w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float` + fade and zoom.
Panel on phones: a bottom `Sheet` with `hideClose` and `flex max-h-[70dvh] flex-col overflow-hidden pb-[max(env(safe-area-inset-bottom),0.5rem)]`, an sr-only title and `min-h-12` rows.
1. Search row `flex h-11 shrink-0 items-center gap-2 border-b border-border px-3`: Search icon, input `h-full min-w-0 flex-1 bg-transparent text-base md:text-sm outline-none placeholder:text-muted` with autocomplete, autocorrect and spellcheck off, and `N of M` (`text-xs text-muted tabular-nums`) once M passes 20.
2. List `relative max-h-64 overflow-y-auto overscroll-contain p-1`; row `flex w-full cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors data-[active=true]:bg-surface`; label `block truncate`, secondary `block truncate text-xs text-muted`; single-select check `ml-auto size-4 shrink-0 text-accent`; multi-select box `flex size-4 items-center justify-center rounded-[5px] border`, `border-accent bg-accent text-white` when checked, `border-border bg-card` otherwise.
3. Disabled rows stay visible with the reason appended to the secondary line (`Down for maintenance`), `cursor-not-allowed`, label `text-muted`.
4. Empty: `px-3 py-6 text-center text-sm text-muted` reading `No matches for "query"`.
5. Clear row at the top when `clearable` and a value is set: X icon, `text-muted`, "Clear selection".
6. Create row pinned under the list in `border-t border-border p-1`: `font-semibold text-accent`, Plus, `Create "query"`.
7. Multi footer `flex items-center justify-between gap-2 border-t border-border px-3 py-2`: `N selected`, ghost sm Clear, secondary sm Done.

Behaviour: every typed word must appear somewhere in the label, description or keywords (case-insensitive); the highlight starts on the selected row; arrow keys move and skip disabled rows, Enter picks, Escape closes; the query resets on close because the panel unmounts; multi-select keeps the panel open; rows call `preventDefault` on mouse down so focus stays in the search input; the highlight scrolls into view inside the list, never the page.
a11y: trigger `role="combobox" aria-haspopup="listbox" aria-expanded aria-controls`; search input `aria-autocomplete="list" aria-activedescendant`; list `role="listbox"` (+ `aria-multiselectable`); rows `role="option" aria-selected aria-disabled`. A combobox takes no name from its content: a FormField label names it through `id`, otherwise pass `aria-label`, and without either the placeholder names it (CMMS).

## SecretField (write-only)
A stored secret never travels back to the page. Stored: `type="password"`, an empty value, the placeholder `••••••••` and the hint "A token is stored. Leave this empty to keep it."; not stored: a placeholder that names what to paste ("Paste the BotFather token") and the hint "Not set yet." Save sends the field only when the user typed into it. A secret that lives in the server environment gets a hint that names the variable and no field ("The signing secret lives in the API environment as WEBHOOK_SECRET and never reaches this page."). A value to copy (a webhook or API URL) is a read-only `inputClassName="bg-surface font-mono text-xs"` input with an outline icon Copy button beside it.

## Unavailable options (rollout gates)
A feature the current rollout does not cover stays visible and disabled, so admins see what is coming: a toggle row at `opacity-50` with a disabled Switch and the sublabel "not available yet"; a chip `disabled` at `opacity-40` with `title="Not part of this rollout yet"`; a select option or combobox row disabled unless it is the saved value; a FormField hint that names what arrives later ("Door, motion, power and panic sensors are not part of this rollout yet."). One gate in the types package decides (`ENABLED_SENSOR_TYPES` and `isSensorTypeEnabled(type)`), and every form, dialog and wizard step reads it. Actions a role may not take stay hidden.

## Switch
`group relative inline-flex shrink-0 items-center rounded-full bg-silver/60 transition-colors data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50` + focus ring. md `h-7 w-12` with knob `absolute left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform group-data-[state=checked]:translate-x-5`; sm `h-5 w-9` with a `size-4` knob and `translate-x-4`. `role="switch" aria-checked`.

## SegmentedControl (one answer)
For answers, not navigation: Pass / Fail, Confirmed / Not OK, Normal / Rough / Loud. `role="radiogroup"` with roving arrow keys.
Track `inline-flex max-w-full items-center gap-1 rounded-full bg-surface p-1`; option `inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors active:scale-[0.98]` at `h-10` (sm `h-8`), unselected `text-body hover:bg-black/5`. The selected option takes its own tone: default `bg-ink text-on-ink` · success `bg-success text-white` · warning `bg-warning text-white` · danger `bg-accent-strong text-white` (the label is small white text, so it takes the strong fill). Touch version: `className="w-full [&_[role=radio]]:h-12"`.
Choice grid, for more than four options (pause reasons): `grid grid-cols-2 gap-2` of `role="radio"` buttons `flex min-h-12 items-center rounded-2xl px-4 py-2 text-left text-sm font-semibold active:scale-[0.98]`, selected `bg-ink text-on-ink`, others `bg-surface text-body`.

## Tabs
Shared: `role="tablist"` with roving keys; trigger `group inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors [&_svg]:size-4` + focus ring; optional count pill `rounded-full px-1.5 py-px text-[10px] font-bold leading-4 tabular-nums`, `bg-surface text-body` or `bg-white/20 text-current` on the active pill.
- PillTabs (view switch): list `no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-card p-1 pr-6 shadow-card`; trigger md `h-9 px-4 text-sm` (sm `h-8 px-3 text-xs`) + `rounded-full text-muted data-[state=active]:bg-ink data-[state=active]:text-on-ink`.
- UnderlineTabs (inside cards and page cards): list `no-scrollbar flex w-full overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]`. The inset shadow draws the baseline so the scroll box never clips the active underline. Trigger `border-b-2 border-transparent px-3 py-2.5 text-sm text-muted focus-visible:ring-inset data-[state=active]:border-accent data-[state=active]:text-foreground`.
- SegmentedTabs (mobile list tabs, equal width): list `flex w-full gap-1 rounded-full bg-card p-1 shadow-card`; trigger `h-10 min-w-0 flex-1 shrink rounded-full px-2 text-xs text-muted data-[state=active]:bg-ink data-[state=active]:text-on-ink`; the tab named by `urgentValue` turns `bg-accent-strong text-white` when active. Touch screens raise the height with `className="[&_[role=tab]]:h-11"`: the descendant form, because the tabs sit inside the `role="tablist"` div and a child selector (`[&>[role=tab]]`) never matches them.
Scrolling pill and underline lists get a right fade so the cut-off reads as more content: `pointer-events-none absolute inset-y-0 right-0 w-7 bg-linear-to-l from-card to-transparent` inside a `relative min-w-0` wrapper (`w-fit max-w-full` for pills).

## Chip / ChipRow
base `inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 [&_svg]:size-4` + focus ring, with `aria-pressed` and `data-active`.
- default (toggle chips inside cards): `border border-border bg-card px-3.5 text-xs text-body data-[active=false]:hover:bg-surface data-[active=true]:border-accent-strong data-[active=true]:bg-accent-strong data-[active=true]:text-white`
- filter (filter rows on the canvas): `bg-card px-4 text-sm text-body shadow-card data-[active=false]:hover:bg-surface data-[active=true]:bg-ink data-[active=true]:text-on-ink`

Count pill `rounded-full px-1.5 py-px text-[10px] font-bold leading-4 tabular-nums` (`bg-white/20` when active, `bg-surface text-body` otherwise). An "All" chip carries the total and resets the filter; clicking the active chip clears it.
ChipRow `no-scrollbar flex gap-2 overflow-x-auto pb-1`, with no negative margins, so it is safe inside the admin scroll box (`className="max-w-full"`). The mobile PWA may bleed it to the screen edge with `-mx-5 px-5` and `h-11` chips.

## Steps (lifecycle stepper)
`<ol class="no-scrollbar flex gap-2 overflow-x-auto pb-2 pr-10">` inside `relative min-w-0`, with a right fade `w-10 bg-linear-to-l from-surface to-transparent`. Step `relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold`:
current `bg-ink text-on-ink` (`aria-current="step"`) · done `bg-card text-foreground shadow-card` with a `flex size-5 items-center justify-center rounded-full bg-success-soft text-success [&_svg]:size-3` check · upcoming `bg-surface-2 text-muted` · skipped `bg-surface-2 text-silver`. Steps that are not done show their index `text-xs tabular-nums opacity-60`; an optional hint sits under the label in `text-[11px] font-medium opacity-70`; each step carries sr-only state text.
Place it in its own `Card className="p-5"` under a detail hero and derive the states from the entity's status flow (a cancelled record marks every step `skipped`).

## ProgressBar / SegmentBar
ProgressBar: `role="progressbar"` with `aria-valuetext`; track `w-full overflow-hidden rounded-full bg-surface` (`bg-white/25` behind the white fill on dark), heights xs `h-1` · sm `h-1.5` · md `h-2.5`; fill `h-full rounded-full` in ink (default), accent (at risk, shortage), success, warning, info or white. Caption under it: `mt-1 text-[11px] text-muted`.
SegmentBar (part-to-whole in one line): `flex w-full gap-0.5 overflow-hidden rounded-full` at `h-2.5` (sm `h-1.5`); segments `h-full min-w-1` sized with `flex-grow: value; flex-basis: 0`; zero segments are skipped; `role="img"` with a "label: value" list. Legend under it: `mt-3 flex flex-wrap gap-4 text-xs text-muted` of `inline-flex items-center gap-1.5` items (a `size-2 rounded-full` dot, the label, the value).

## Gauges (one measured point against its limits)
A reading is `normal` inside the band an admin set, `high` above the upper limit, `low` below the lower one, `unknown` without a reading; labels Normal · Above limit · Below limit · No reading; colours success · accent · info · muted.
- `SensorPointCard`: `rounded-[22px] bg-card p-4 shadow-card`; header `flex items-start justify-between gap-2` with the name `truncate text-sm font-semibold` over the kind `truncate text-xs text-muted`, and the status `shrink-0 text-xs font-semibold` in its colour; dials `mt-3 flex flex-wrap items-end justify-center gap-5`; footer `mt-3 border-t border-border pt-3 text-xs text-muted` ("Updated 3 min ago" on the left, an accent "2 open alerts" on the right). The card shows the worst status of its dials: high, then low, then the first.
- `RadialGauge`, an SVG `viewBox="0 0 200 172"` at `w-full max-w-[220px]`: a 270° arc from 135° with a 16px stroke and round caps; the track in `BRAND.border`; the segment below the lower limit in info, the band between the limits in success, the segment above the upper limit in accent; the limit values at radius 58 in `text-[11px] font-semibold fill-muted`; a 4px ink needle from the centre and an ink hub (`r=8`) with a white `r=3.5` dot; the value `text-[26px] font-bold tabular-nums fill-foreground` over the unit `text-[12px] font-medium fill-muted`; under it a status pill `mt-1 rounded-full px-3 py-1 text-xs font-semibold` (normal `bg-success-soft text-success`, high `bg-accent-soft text-accent-strong`, low `bg-info-soft text-info`, unknown `bg-surface text-muted`). The scale runs from 10 below the lower limit to 10 above the upper one, so a reading outside the band still lands on the dial. `role="img"` with an aria-label that speaks the value, the unit and the status.
- `LevelBar` (humidity, 0 to 100): track `relative h-36 w-7 overflow-hidden rounded-full bg-surface-2`, the band tinted `bg-success/25`, a fill from the bottom in the status colour, a `h-0.5 bg-ink` marker at the value; scale ends on the left and "60 max" / "30 min" on the right in `text-[10px] font-semibold text-muted`; the value `mt-2 text-lg font-bold tabular-nums` above the status pill.
- `StateDial` (door, motion, power, panic): `flex size-28 items-center justify-center rounded-full text-sm font-bold text-white ring-8`, `bg-accent ring-accent-soft` in alarm, `bg-success ring-success-soft` when quiet; the label is the state word from a `{ normal, alarm }` map per sensor type ("Closed" / "Open").
A detail page lists its points in `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3`; a phone opens one point in a bottom sheet with the card at `bg-surface shadow-none`.

## Avatar / AvatarStack
`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none text-white`, `role="img" aria-label={name}`, initials of the first two words. Colour: the person's stored colour, or a hash of the name into a muted palette that keeps white initials readable (`#4c5a78 #6a5a8c #3f7a7b #7a5f4a #557a5c #8a5a6e #4f6f94 #7a6b3f #5c5c7a #6b6f73`).
sizes xs `size-6 text-[9px]` · sm `size-7 text-[10px]` · md `size-9 text-xs` · lg `size-12 text-sm` · xl `size-20 text-2xl`; `ring` adds `shadow-card ring-4 ring-card` (screen header, profile card).
AvatarStack `flex items-center -space-x-2`, each avatar `ring-2 ring-card`, overflow `+N` on `bg-surface text-body`. PersonChip (app level): avatar, name and a muted hint, linking to the person.
An admin-picked colour comes from a short list that leads with the brand, `AVATAR_COLORS` in `lib/brand.ts` (ink, accent, then `#1d4ed8 #047857 #b45309 #6d28d9 #0e7490 #be185d`); a new person defaults to the ink, in the UI and in the API's default alike.

## DataTable
Props that carry conventions: `columns` (`id, header, cell, sortValue?, align?, hideBelow?: 'sm' | 'md' | 'lg' | 'xl', width?`), `getRowKey`, `onRowClick`, `pageSize` (12; 0 turns paging off), `empty`, `initialSort`, `rowClassName`, `resetPageKey` (the search and filter string: page 1 when it changes), `initialState` + `onStateChange` (restore sort and page after Back).
Table `w-full border-collapse text-sm` inside `relative overflow-x-auto`; header row `border-b border-border`; th `h-10 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted`; a sortable header is a pill button `-mx-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-1 hover:text-foreground` with ChevronsUpDown (`opacity-40`), ChevronUp or ChevronDown at `size-3.5`, and `aria-sort` on the th; td `px-4 py-3 align-middle`; row `border-b border-border transition-colors last:border-b-0 hover:bg-surface-2 data-[clickable=true]:cursor-pointer`.
Clickable rows: the first cell gains a round open button `size-8 rounded-full text-muted hover:bg-card hover:text-foreground` with ArrowUpRight (`aria-label="Open <key>"`), so keyboard users get a real control. A click that starts on a nested control or inside a portal (menu, dialog) never opens the row. CMMS reaches the same goal differently: the title in the first cell is a real link (its `onClick` stops propagation), and the row itself takes `tabIndex={0}`, opens on Enter and shows `focus-visible:bg-surface-2`.
Sorting puts nulls last in both directions and compares strings with `localeCompare(…, { numeric: true })`, so `A2` sorts before `A10`.
Pagination `flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted`: `1-12 of 52` (tabular) and two outline `icon-sm` chevron buttons.
Empty body: one full-width cell with `EmptyState compact` ("Nothing to show", or the caller's `empty`). While rows for a range load from the server, the same slot says so ("Loading readings…").
A table that can scroll sideways sits in a focusable region (`tabIndex={0} role="region" aria-label="Data table. Scroll horizontally to see more columns."`) so a keyboard user can scroll it.
Cell conventions:
- First column: the identifier `font-mono text-xs font-semibold` over the name `truncate text-sm`, then phone-only copies of what hides: a badge line `mt-1.5 flex flex-wrap gap-1.5 sm:hidden`, a meta line `mt-1.5 text-[11px] leading-4 text-muted md:hidden`, or a small meter `mt-1.5 sm:hidden`.
- Hide columns in order of importance with `hideBelow`: status at `sm`, the linked order or machine at `md`, context and "why" text at `lg`, raw ids at `xl`, so a phone keeps two columns.
- Numbers `align="right"` with `tabular-nums`; a quantity adds its unit as `<span class="text-xs text-muted">kg</span>` (`whitespace-nowrap`); signal columns put the unit in the header ("°C", "RPM"). Colour a number only when it breaks a limit: `font-semibold text-accent` past a hard limit, `font-semibold text-warning` past a soft one. A late date is `font-semibold text-accent`. A missing value is a muted en dash `<span class="text-muted">–</span>`.
- Meter column (`width: '9rem'` to `'11rem'`): a `mb-1 text-xs font-semibold tabular-nums` value (or `mb-1 flex items-center justify-between text-xs` with a `hidden sm:inline-flex` badge) above a ProgressBar, or a ProgressBar with a `mt-1 text-[11px] text-muted tabular-nums` caption ("12 / 40 good"). Tone: ink (info on a live board), warning when paused or above about 80%, accent when held, late, short or over the limit, success when done.
- Trend cell: `Sparkline height={28}`.
- Row tint for aging records: `rowClassName={(r) => (aging(r) ? 'bg-warning-soft/40' : undefined)}`; a live record at the top priority (a P1 work order) takes `bg-accent-soft/40`.
- Row actions: master data uses a trailing `flex justify-end gap-1` of ghost `icon-sm` buttons (edit; remove in `text-accent`, disabled with `title={blockReason}` when something references the row) in an `_actions` column `width: '5.5rem'`. Operational lists use labelled `variant="outline" size="sm"` verb buttons ("Allocate", "Release"), with `variant="secondary"` for the one-click resolve. Neither needs `stopPropagation`, because nested controls never open the row.
- Sort: `initialSort` on the severity or date column, descending; `resetPageKey` joins the filter values (`${query}|${status}|${view}`); `pageSize={0}` for line items and live lists.
Placement: a list page's main table sits on the canvas under its filters, full width and without a card; its row dividers do the separating. A table that is one section of a detail or analysis page goes inside a `Card` under a `CardHeader`. CMMS uses the other list-page form: its view tabs, filter row and main table share one Card (patterns → List page). Pick one form per product.

## KeyValue
`dl.divide-y.divide-border`, standalone as `rounded-card bg-card px-5 py-1 shadow-card` or `bare` inside a CardContent. Row `grid gap-3 py-3 text-sm` with label widths sm `grid-cols-[96px_minmax(0,1fr)]` · md `grid-cols-[120px_minmax(0,1fr)]` · lg `grid-cols-[150px_minmax(0,1fr)]`; `dt text-muted`; `dd min-w-0 break-words`. Items accept `hidden` for conditional rows. Values may be badges, person chips, mono codes (`text-xs font-mono`) or links (`hover:text-accent`).

## EmptyState
`flex flex-col items-center justify-center gap-2 text-center` at `px-6 py-12`, or compact `px-4 py-8` inside cards and tables; icon tile `mb-1 flex size-12 items-center justify-center rounded-full bg-surface text-muted [&_svg]:size-6` (Inbox by default, `icon={null}` for none); title `text-sm font-semibold text-foreground`; description `max-w-xs text-sm text-muted`; action `mt-2`.
Copy: the title names what is missing ("No inspections yet"), the description says how records arrive ("Requests appear when an operation with a quality check starts"), the action offers the next step.
A filtered list writes a second empty state for no matches: the title says nothing matches ("No work orders match"), the description says how to see more, and the action is an outline sm "Clear filters". On a phone, a tabbed list's empty state first points at the sibling tab ("Open Doing"), then at a general action ("Scan an asset").
Not-found detail page: a `Card` holding `EmptyState title="Order not found" description="It may have been removed or belongs to another site." action={<BackButton fallback="/orders" />}`.

## Banner
`flex flex-wrap items-center gap-3 rounded-card px-4 py-3` + tone box; icon tile `flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4` + tone tile; text `min-w-[12rem] flex-1 text-sm` with the title `font-semibold text-foreground` over `text-body/70` copy; actions `flex min-w-0 max-w-full flex-wrap items-center gap-2`; dismiss is a ghost `icon-sm` X.
tones: info `bg-info-soft` with tile `bg-card text-info` (Info) · warning `bg-warning-soft` / `bg-card text-warning` (TriangleAlert) · danger `bg-danger-soft` / `bg-card text-danger` (CircleAlert) · success `bg-success-soft` / `bg-card text-success` (CircleCheck) · neutral `bg-card shadow-card` / `bg-surface text-body`.
Uses: a blocker that explains a disabled action ("Not ready to start", "Cannot complete yet"), a rule reminder whose tone escalates once the current input triggers the rule ("Hold rule", info to warning), the storage-failure notice at the top of `main`.
Inline blocker note on an admin detail page, lighter than a banner: `<Card className="p-4 text-sm"><span class="font-semibold">Cannot complete yet:</span> {reason}</Card>`.
Result callout (the outcome of an action inside a card: parse, test, send): `flex items-center justify-between gap-3 rounded-2xl p-3 text-sm`, success `bg-success-soft text-success` with `role="status"`, failure `bg-danger-soft text-accent-strong` with `role="alert"`, and an optional sm button to the result ("Open alert").

## SplitStats
`-mx-5 -mb-5 mt-auto grid divide-x divide-border border-t border-border` with 2 to 4 equal columns; cell `min-w-0 px-2 py-3 text-center`, label `block truncate text-[10.5px] font-medium text-muted`, value `block truncate text-[15px] font-extrabold tabular-nums`. Make it the last child of a `p-5` CardContent so it sits flush with the card edge; add `mt-5` when a list sits above it.

## PageHeader / Kicker
PageHeader `mb-6 flex flex-wrap items-start justify-between gap-3`: optional eyebrow (a kicker with `mb-1`), `h1 text-2xl font-bold tracking-tight`, description `mt-1 max-w-2xl text-sm text-muted`, one sentence that says what the screen is for; actions `flex min-w-0 max-w-full flex-wrap items-center gap-2` (`max-w-full` makes a wide pill-tab row scroll instead of the page). List-page actions: a pill search `min-w-0 flex-1 sm:w-72 sm:flex-none` and the primary button. On phones let the actions take the whole row with `className="[&>div:last-child]:w-full sm:[&>div:last-child]:w-auto"`. A role that may only read sees `<Badge variant="muted"><Lock />View only</Badge>` in the actions slot (CMMS master data).
Kicker `text-[11px] font-semibold uppercase tracking-wider text-muted` (`text-on-ink-muted` on ink).

## Dialog
Content `fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-card p-6 text-foreground shadow-float outline-none duration-200` + fade and zoom; sizes sm `max-w-sm` · md `max-w-lg` · lg `max-w-2xl` · xl `max-w-4xl`; header `mb-4 flex flex-col gap-1 pr-6`; title `text-lg font-semibold leading-tight`; description `text-sm text-muted`; footer `mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end` (outline Cancel, primary Save).
Focus returns to whatever opened the dialog, including a menu item or a global Create button that is no Radix trigger (CMMS `useReturnFocus` in `lib/overlay.ts`): store `document.activeElement` in `onOpenAutoFocus`, then focus it in `onCloseAutoFocus` while it is still connected. Sheets do the same.
Entity dialog: one `<Entity>Dialog` per entity with `open`, `onOpenChange`, `editing: Entity | null` (null creates) and `onSaved`. Mount the form only while the dialog is open, so its state resets on every open:
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent size="md">{open && <EcoForm editing={editing} onDone={(saved) => { onOpenChange(false); if (saved) onSaved?.(saved) }} />}</DialogContent>
</Dialog>
// inside the form
const [tried, setTried] = useState(false)
const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)
// <form noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (Object.values(errors).some(Boolean)) return; … }}>
// <FormField label="Product" required error={show(errors.product)}><ProductPicker invalid={!!show(errors.product)} … /></FormField>
```
- Layout: no section headings; the body is `grid grid-cols-1 gap-4 sm:grid-cols-2` with `sm:col-span-2` on the main picker and the notes, or `space-y-3` around sub-grids such as `grid grid-cols-2 gap-3 sm:grid-cols-4` for a row of numbers.
- The DialogDescription states the rule that governs the record; in edit mode it names what stays fixed, and that field renders as `<Input readOnly>`.
- Errors are full-sentence instructions ("Choose the product."); optional fields say so in the hint ("Optional until dispatch"); defaults show as the placeholder with a hint naming their source ("Site default 5").
- Boolean row: `flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3` with a `text-sm font-medium` title, a `text-xs text-muted` line and a Switch.
- Multi-choice from a short list: `Chip variant="filter"` with a Check icon when active.
- Dependent pickers: changing the parent clears its children; the child is `disabled` with the placeholder "Choose an order first".
- Preview or computed result: `mt-4 rounded-2xl bg-surface-2 p-3 text-sm`. A live check that blocks submit: `mt-2 rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-accent-strong`, with submit disabled while it shows.
- Quantities: the unit goes in the hint ("In kg", "Pieces"), the field starts at the remaining amount, and the input takes `inputMode="decimal" step="any"`.
- One dialog may serve a family of verbs (reserve, stage, issue, consume) through a copy table keyed by the verb.
- Footer: outline Cancel and a primary named with the verb ("Raise NCR", "Save changes").

## ConfirmDialog
AlertDialog at `max-w-md` with the Dialog panel classes. Title `text-lg font-semibold leading-tight`, phrased as a question with the record code (`Pause WO-2026-002819?`); description `mt-1.5 text-sm text-muted`, one sentence with the consequence ("Running and ready work orders pause until the hold is released."); optional `children` in `mt-4` (`space-y-3` for a reason picker and a note); footer outline Cancel + a primary named with the verb. `destructive` restyles confirm to `bg-accent-strong text-white shadow-none hover:bg-accent-dark` (a raw `bg-danger` fill puts the small white label under AA); `confirmDisabled` holds it until a required field is filled.
- Short decisions use it instead of a full dialog: hold with a reason, cancel, release with a date whose hint counts the affected records, a disposition picker (`destructive` when the choice is scrap).
- Approve and reject share one `deciding: 'approved' | 'rejected' | null` state: `destructive={deciding === 'rejected'}`, `confirmDisabled={deciding === 'rejected' && !note.trim()}`, with a Note textarea (`min-h-20`) as the child.
- A delete that something blocks opens `destructive confirmDisabled` with a description naming the blocker. CMMS may turn the confirm into the safe alternative instead ("Retire asset" in place of "Delete asset", with a description of what retiring keeps).
- A delete started on the record's own page navigates to the list first (`replace`), then dispatches and toasts, so the page never flashes its own not-found state.
- Queue pages hold one `pending: { kind, id } | null` state and mount the matching dialog with `key={pending.id} open`.
- Master data says "Remove {name}?"; documents and transactions say "Delete" or the lifecycle verb.

## Sheet
Right (tablet and up, for a detail panel opened from a row): `fixed inset-y-3 right-3 z-50 flex w-[calc(100%-1.5rem)] flex-col rounded-hero shadow-float`, floating like the rail; sizes md `max-w-md` · lg `max-w-xl` · xl `max-w-2xl`; slides from the right. SheetHeader `flex flex-col gap-1 px-5 pb-3 pr-14 pt-5` · SheetBody `min-h-0 flex-1 overflow-y-auto px-5 pb-5` · SheetFooter `flex items-center justify-end gap-2 border-t border-border px-5 py-4`. CMMS and MES open every record on its own route and never use the right sheet; keep it for quick triage of a stream (monitoring alerts), never as a record's only page.
Bottom (phones): `fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),1rem)]`, slides from the bottom, grab handle `mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border` (`bg-white/20` on dark).
Tones: light `bg-card text-foreground`; dark `bg-ink text-on-ink`, reserved for navigation.
**On phones every menu is a bottom sheet**: the More menu, overflow menus, the create menu, filters, sort, notifications and every combobox panel.

## ActionMenu (overflow and create menus)
One component with two renderings: an anchored DropdownMenu from `md` up and a light bottom sheet on phones. Items are `{ key, label, description?, icon?, onSelect, destructive?, disabled? }` or `'separator'`, with an optional `title` (the record code).
Dropdown content `z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-48 overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-float` (sideOffset 8, collisionPadding 8); item `relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface data-[disabled]:opacity-50 [&_svg]:size-4`, destructive `text-accent`; label `px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted`; separator `-mx-1 my-1 h-px bg-border`.
Sheet rows `flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-sm font-medium hover:bg-surface active:scale-[0.98]` with an `IconTile size="sm"` (danger tone when destructive), the label and a `text-xs font-normal text-muted` description; title in a `SheetHeader` at `pb-2 pt-3` with `text-base` (sr-only when there is none).
Record overflow trigger: `<Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button>`. Build the items with `condition ? item : null` and filter, so the menu lists only actions the user may take in the record's current state.

## Popover / Tooltip / Toast
Popover content `z-50 rounded-2xl border border-border bg-card p-0 shadow-float` (sideOffset 8, collisionPadding 8), used for the notification panel at `w-[400px] align="end"`.
Tooltip `z-50 max-w-xs rounded-xl bg-ink px-2.5 py-1.5 text-xs font-medium text-on-ink shadow-float` (sideOffset 6, collisionPadding 8). Keep it controlled so toggling `disabled` never remounts the trigger, and mount one `TooltipProvider delayDuration={200}` at the root. Collapsed rail items use it for their labels (`side="right" sideOffset={22}` to clear the rail).
Toast: `toast(message, { tone?: 'default' | 'success' | 'danger', description?, action? })` backed by a small external store; mount `<Toaster />` once. Stack `pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-4 md:right-4 md:items-end md:px-0`, which clears the phone bar; at most 3, 3.5 s each. Toast `pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-on-ink shadow-float animate-in fade-in-0 slide-in-from-bottom-2`; tone mark `mt-px flex size-5 items-center justify-center rounded-full text-white [&_svg]:size-3` on `bg-success` (Check) or `bg-accent` (CircleAlert); message `font-medium`; description `mt-0.5 text-xs text-on-ink-muted`; action `rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20`; dismiss is a round `size-6` X.
Every mutation ends in a toast. The message states the result in the past tense ("Hold released", "12 pieces recorded"); the description carries the quantity, unit and code or the consequence ("12 good on WO-2026-002819", "The batch is on quality hold."). Tones: `success` for create, save and advance; `default` for pause, hold, cancel, remove and delete; `danger` for a rejection, a failure or a blocked action, whose description is the blocker.
With a server behind the store, the success toast and any success view wait for the server's answer; a refused request leaves the form as it was, and the danger toast's description is the server's reason.

## Data states (API-backed apps)
- First load: the layout renders the page once the data has arrived. Admin: `space-y-3` with a `text-sm text-muted` line that names the thing ("Loading distribution center…"), a `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4` of four `h-28 animate-pulse rounded-[22px] bg-surface-2` blocks and one `h-72` block, wrapped in `role="status" aria-live="polite"`. Mobile: "Loading your outlets…" over three `h-24 animate-pulse rounded-[24px] bg-white/70` blocks.
- Load failed: the admin puts a `role="alert"` row at the top of `main`, `mb-3 flex items-center justify-between gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-accent-strong`, with an outline sm "Try again"; the mobile app shows a centred card `mt-10 rounded-[24px] bg-card p-5 text-center shadow-card` with a bold "Couldn't load your data", the reason in `text-xs text-muted` and a full-width ink "Try again".
- Crash: an `AppErrorBoundary` around the providers renders a centred `max-w-sm rounded-[24px] bg-card p-6 text-center shadow-card` card with "Something went wrong", one sentence, the message in a `pre max-h-24 overflow-auto rounded-xl bg-surface p-3 text-left text-[11px] text-muted`, and a full-width ink "Sign out and reload" that clears what the app stored in the browser. Without it React unmounts the tree and leaves a blank page.
- New events: an `sr-only` paragraph with `role="alert" aria-live="assertive"` in the shell announces arrivals ("2 new alerts received.").

## PhotoInput / SignaturePad
PhotoInput `grid grid-cols-3 gap-2`. Thumbnail `relative aspect-square overflow-hidden rounded-2xl bg-surface` with an `size-full object-cover` image and a remove button `absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink [&_svg]:size-3.5`. Add tile: a `label` wrapping a hidden file input (`accept="image/*" capture="environment" multiple`), `flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface px-2 text-center text-xs font-semibold text-body hover:bg-surface-2 active:scale-[0.98] focus-within:ring-2 focus-within:ring-accent/40 [&_svg]:size-5` with a muted Camera icon; it disappears once `max` photos are in.
Upload variant, for proof photos on a form backed by a server: thumbnails of uploaded files (a green check `size-6` bottom left, the remove button top right) above a zone `flex flex-col items-center gap-3 rounded-[22px] border-2 border-dashed border-silver/70 bg-surface p-6 text-center` (`opacity-60` when full or busy) holding a round white `size-12 shadow-card` icon tile (a spinner while busy), a status line `text-xs font-semibold` with `aria-live="polite"` ("Uploading photos · 60%", "2 of 4 photos uploaded"), a `text-[11px] text-muted` helper, a green `h-1.5` progress bar, and two pills, an ink Camera (`capture="environment"`) and a white Browse. Each photo uploads the moment it is picked and the form keeps the stored paths; the submit waits while uploads run and reads "Uploading photos…".
SignaturePad `relative h-40 w-full rounded-2xl bg-surface`: a signature line `absolute inset-x-6 bottom-9 h-px bg-border`, a transparent `touch-none` canvas at device pixel ratio stroked in `--color-ink` (2px, round caps), a "Sign here" placeholder in `text-sm text-muted`, and a ghost sm Clear at `absolute right-2 top-2`. It emits a PNG data URL after each stroke.

## Lazy list (mobile)
`useLazyList(items, { pageSize: 6, resetKey })` reveals 6 more per page and resets only when `resetKey` changes (the tab or filter), never on array identity; it can report its count and restore it after a remount.
Sentinel `flex items-center justify-center gap-2 py-4 text-xs text-muted`: `N more` (tabular), a dot, and a `rounded-full px-1 font-semibold text-accent hover:underline` Load button. An IntersectionObserver (`rootMargin: 120px`) loads the next page and re-arms after each load, so a sentinel still on screen keeps loading.

## Rail parts
Rail `flex h-full flex-col rounded-hero bg-ink py-4 text-on-ink shadow-float transition-[width] duration-200`; collapsed `w-[76px] items-center`, expanded `w-60 px-3`. Slots top to bottom: header, action (`mt-4`), nav (`mt-3 flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto p-1 no-scrollbar`, where p-1 leaves room for focus rings), workspace (`mt-3`), footer (`mt-3 flex flex-col gap-1`).
RailItem `relative flex shrink-0 items-center rounded-2xl text-on-ink-muted transition-colors hover:bg-white/10 hover:text-white [&_svg]:size-5 data-[active=true]:bg-accent-strong data-[active=true]:text-white data-[active=true]:shadow-glow` + focus ring (`accent-strong`, because the expanded item shows its label in white). Collapsed `size-11 justify-center`, with the label in a right tooltip and an sr-only label plus count; expanded `h-11 w-full gap-3 px-3 text-sm font-medium`; sub-item `h-9 w-full gap-3 pl-11 pr-3 text-[13px] font-medium`; a `trailing` slot holds a rotating ChevronDown (`!size-4`); the badge is a white CountBadge (`absolute -right-1 -top-1` collapsed, inline with `ring-0` expanded). With `asChild` it passes the classes to a router NavLink and replaces its content.
RailAction (create): collapsed `size-11 rounded-full bg-accent-strong text-white shadow-glow hover:-translate-y-px hover:scale-105 hover:bg-accent-dark` (the same fill as a primary button, since the expanded form carries a label); expanded `h-11 w-full gap-2 rounded-full px-4 text-sm font-semibold` with the label. It forwards its ref, so it can be a menu trigger.
RailWorkspace (tenant or site switcher): expanded `flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-ink-2 p-2.5 text-left hover:bg-ink-3 active:scale-[0.98]` with a `size-9 rounded-xl bg-card text-ink [&_svg]:size-[18px]` tile, kicker `text-[10.5px] font-semibold text-on-ink-muted`, name `text-[12.5px] font-bold text-white` and ChevronsUpDown; collapsed, the tile alone as `size-11 rounded-2xl bg-card text-ink hover:bg-surface` with a tooltip. It triggers a DropdownMenu (`side="top"` expanded, `side="right"` collapsed): a "Switch site" label, one row per site (icon, name, `text-xs text-muted` city, accent Check on the current one), a separator, Sign out.
RailCollapse: expanded `flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-xs font-semibold text-on-ink-muted hover:bg-white/10 hover:text-white` with PanelLeftClose and "Collapse menu"; collapsed `size-11 rounded-2xl` with PanelLeftOpen and an "Expand menu" tooltip; `aria-expanded`. Render it only where the rail can expand (≥ xl).

## BottomBar parts (admin on phones)
BottomBar `fixed inset-x-3 bottom-3 z-40 mb-[env(safe-area-inset-bottom)] flex h-[68px] items-center justify-between rounded-[22px] bg-ink px-3 shadow-float md:hidden`.
BottomBarItem, icon only with the count in its `aria-label`: `relative flex size-11 shrink-0 items-center justify-center rounded-2xl text-on-ink-muted hover:bg-white/10 hover:text-white active:scale-[0.98] [&_svg]:size-5 data-[active=true]:bg-accent-strong data-[active=true]:text-white data-[active=true]:shadow-glow` with a white CountBadge at `-right-1 -top-1`.
BottomBarAction (centre create): `flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-strong text-white shadow-glow hover:bg-accent-dark active:scale-[0.98] [&_svg]:size-5`.

## Composite rows (built in pages from the parts above)
- Nested list row inside a card: `flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-surface`, a Link when it opens something; title `block truncate text-sm font-semibold`, meta `block truncate text-xs text-muted` joined with ` · `; right column `hidden shrink-0 flex-col items-end gap-1 sm:flex` (badge over a `text-xs text-muted tabular-nums` value) plus a phone copy under the meta, `mt-1.5 flex flex-wrap items-center gap-2 sm:hidden`. For aligned columns use the grid form `grid grid-cols-[2.5rem_1fr] items-center gap-3 sm:grid-cols-[2.5rem_1fr_auto]`.
- Sequence tile (operation number, rank): `flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-xs font-bold tabular-nums shadow-card`.
- Row with its own action: a `div` row with the same classes, an inner `Link className="flex min-w-0 flex-1 hover:text-accent"`, and a trailing `Button size="sm"` named with the verb.
- Selected state: a compact row in a picker list fills `bg-ink text-on-ink`; a selectable white card takes `ring-2 ring-ink`; the record a deep link points at takes `ring-2 ring-accent` and scrolls into view (`block: 'center'`).
- Ranked row: `flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-surface` with a rank tile `flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-xs font-bold tabular-nums shadow-card`, a head `flex items-baseline justify-between gap-2`, and a meter line `mt-1.5 flex items-center gap-2` (`ProgressBar className="flex-1"` + `shrink-0 text-[11px] text-muted tabular-nums` caption).
- History row: `flex items-start gap-3 rounded-2xl px-3 py-2 hover:bg-surface-2`; time column `shrink-0 pt-0.5 text-xs text-muted tabular-nums` at `w-16` for relative time or `w-12` to `w-14` for a clock time; text `block text-sm`; meta `block text-[11px] text-muted` holding the person and the `font-mono` event type. Newest first.
- Check list (validations, start checks, gates): `grid grid-cols-1 gap-1.5 sm:grid-cols-2` of `flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs` rows. The mark is a round `mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full [&_svg]:size-3` on `bg-success-soft text-success` (pass), `bg-danger-soft text-accent` (blocking fail), `bg-warning-soft text-warning` (advisory) or `bg-surface text-muted` (unknown); then a bold label over a muted note. A failed check links to the place that fixes it.
- Link chips: every entity reference renders as a link built from one `paths` map. Entity chip `inline-flex min-w-0 flex-col hover:text-accent`: the name `truncate font-medium` over the code `truncate font-mono text-[11px] text-muted` (order chips put the code first). Inline code link `font-mono text-xs font-medium hover:text-accent hover:underline`. PersonChip `inline-flex min-w-0 items-center gap-2` with an xs avatar, the name and a `text-xs text-muted` hint (the relative time of the action); no person reads "Unassigned". Chips inside clickable rows call `stopPropagation`; a missing target renders as muted text ("Removed order").
- Revision timeline: `relative space-y-3 border-l border-border pl-5`; each entry has a dot `absolute -left-[26px] top-1.5 size-3 rounded-full ring-4 ring-card` on `bg-success` (released), `bg-warning` (in review) or `bg-border` (obsolete), and the current one carries `Badge variant="ink"` "Current".
- Tree row (genealogy, BOM explosion): `flex items-center gap-2 rounded-2xl p-2 transition-colors hover:bg-surface-2` (the root adds `bg-surface-2`); a ghost `icon-sm` toggle with ChevronRight (`rotate-90` open) or a `size-8 shrink-0` spacer on leaves; an `IconTile size="sm"` whose tone encodes the node kind; a `hidden shrink-0 text-xs text-muted tabular-nums sm:block` timestamp; children in `ml-6 space-y-1 border-l-2 border-border pl-3`, open by default to a set depth.
- Flow chain (process steps with counts): `no-scrollbar flex items-center gap-1 overflow-x-auto pb-1` of `inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-semibold` steps with a `rounded-full bg-card px-1.5 py-px text-[10px] font-bold tabular-nums shadow-card` count, ChevronRight between steps.
- Metric on ink (hero grid cell): kicker `text-[11px] font-semibold uppercase tracking-wider text-on-ink-muted`, then `mt-1 flex items-end gap-1.5 leading-none` with a `text-3xl font-bold tracking-tight tabular-nums` value and a `pb-0.5 text-xs font-semibold text-on-ink-muted` unit.
- Reading tile (a telemetry value on white): `rounded-2xl bg-surface px-3 py-2.5`, a kicker label, then `mt-1 flex items-start gap-1 leading-none` with a `text-2xl font-bold tracking-tight tabular-nums` value and a `pt-0.5 text-xs font-semibold text-muted` unit; `n/a` when there is no reading. Grid `grid grid-cols-2 gap-2`.
- Readout (a large sensor value): label `text-xs font-medium text-muted`; value `text-4xl font-bold tracking-tight` with the unit `pt-1 text-sm font-semibold text-muted` in `flex items-start gap-1 leading-none`.
- Settings or navigation list: `divide-y divide-border rounded-[24px] bg-card shadow-card` of `flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface` rows: a round `size-11 rounded-full bg-surface text-body [&_svg]:size-5` icon with an optional CountBadge, a `text-sm font-semibold` label over a `truncate text-xs text-muted` hint, and ChevronRight `size-4 text-muted`.
- Total footer inside a card: `mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-3` with a muted label and a `text-base font-bold tabular-nums` value.
- Fact tiles (connection or device facts): `dl grid grid-cols-2 gap-3 text-xs sm:grid-cols-4` of `rounded-2xl bg-surface p-3` cells, `dt text-muted`, `dd truncate font-mono` for addresses and topics or `font-semibold tabular-nums` for counts, then one `text-xs text-muted` line for anomalies ("3 messages matched no sensor").
- Sensor tile (2-up grid in a mobile device card): a `button rounded-[20px] p-4 text-left active:scale-[0.99]`, `bg-surface`, or `bg-accent text-white` while the point is in alarm or has open alerts; a top row with a round `size-9` icon (`bg-card shadow-card`, or `bg-white/20` on accent) and an "N open" pill `rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-accent`; the value `mt-5 text-[26px] font-bold leading-none`, the name `mt-2 truncate text-xs font-medium`, a meta line `truncate text-[10px] text-muted` (`text-white/70` on accent). A tap opens a bottom sheet with the point's gauge card.
- Collapsible section (mobile): a `rounded-[26px] bg-card p-4 shadow-card` card whose header is one full-width button with a round ink `size-10` icon tile, a `text-[15px] font-bold` title over a muted count, and an accent "Show" / "Hide" on the right, with `aria-expanded` and `aria-controls`. Secondary panels (floor plan, map) start closed so the list stays above the fold.
- Answer row (a review question that jumps to its numbers, CMMS reports): `flex items-start gap-3 rounded-2xl bg-surface-2 p-3 text-left transition-colors hover:bg-surface active:scale-[0.98]` + focus ring: an `IconTile size="sm"` (toned when the answer is bad news), the question `block text-xs text-muted`, the answer `mt-0.5 block text-sm font-semibold`, a detail `block text-xs text-muted`, and ChevronRight `mt-2 size-4 text-muted`. Rows sit in `grid grid-cols-1 gap-2 md:grid-cols-2`, and a click scrolls to the section behind the answer.
- Activity timeline with a composer (a record's history plus notes, CMMS): a soft Textarea (`min-h-11`, `aria-label`) beside a secondary "Post" in `mb-5 flex flex-col gap-2 sm:flex-row sm:items-end` (Cmd or Ctrl + Enter posts); under it `ol.relative.space-y-4` whose rail is drawn with `before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-border`, each entry an icon circle on the rail, the event text, and a `text-xs text-muted` "person · when"; newest first, 12 at a time with a "N more" button.

## Inspector row list (right column)
A card with a small-caps title (`text-[13px] font-bold uppercase tracking-[0.4px]`) and a close X. Rows `flex items-center gap-3 rounded-2xl border border-border p-3.5 hover:bg-surface-2`: icon tile `size-9 rounded-xl bg-surface`, a `text-sm font-bold` title over a `text-xs text-muted` subtitle, a chevron; an accent dot marks unsaved changes. Below the rows: a full-width outline primary ("Preview") and a `text-sm font-semibold text-accent` danger link ("Delete").

## Underline tabs + filter pills (gallery page card)
UnderlineTabs in a `flex flex-1` wrapper beside right-side outline pills `h-10 rounded-full border bg-card px-4 text-sm font-semibold` ("Filter", "Sort"), all in a `flex flex-wrap items-end gap-3` row. Pill tabs stay the choice for view switches.

## Page card + "Show more"
A gallery page may sit inside one `rounded-card bg-card p-6 shadow-card`: a header row (`h2 text-[29px] font-extrabold tracking-[-1px]` over `p max-w-[30rem] text-sm text-body/70`, with the search pill and an ink primary on the right), a stat tile row, underline tabs, the grid, then a centred outline pill "Show more" with a chevron that reveals the next page.

## Floor plan / map markers (when a spatial view exists)
Marker `absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-float ring-2 ring-card`; a device marker is `rounded-2xl`. States: normal `bg-ink text-white`, alarm `bg-accent text-white animate-pulse`, offline `bg-silver`, fault `bg-warning-soft text-ink`, muted `bg-card text-muted ring-border`; selected `scale-125 ring-4 ring-accent/40`.
The floor plan's walls and doors stroke in `BRAND.ink`. Map circle markers (Leaflet): fill accent with open alerts, `BRAND.muted` when offline, ink otherwise, radius 8 with a 2px white ring; the selected one grows to radius 11 with a 3px `BRAND.highlight` ring, which stands out against both fills.

## Charts
See `charts.md` for Sparkline, BarStrip, BarList, ColumnChart, LineChart and Donut, and the shared axis, tooltip and keyboard rules. A chart library in their place reads the same colours from `BRAND` (charts.md → Colour).
