# Charts

The kit draws its own SVG charts (no chart library): `Sparkline`, `BarStrip`, `BarList`, `ColumnChart`, `LineChart`, `Donut`, plus `SegmentBar` and `ProgressBar` from components.md. Each chart measures its container with a ResizeObserver (`useElementSize`), takes the width it is given, and takes `height` as a prop that includes the x-axis labels.

## Colour
- One highlighted value in accent; everything else is context in ink or `chart-muted` grey (`--color-chart-muted: #d4d3d6`). The second series colour is `info`.
- ColumnChart: plain columns stay ink, and `highlight` goes on the columns that break a rule (the latest day, load over 100%, hours over capacity). `tone="muted"` turns the other columns grey when one highlighted value must stand alone. The highlighted column prints its value above it.
- BarStrip (small, axis-free): grey context columns (`fill-chart-muted`, or `fill-white/22` with `onInk`) and the last one (or `highlightIndex`) in accent.
- LineChart and Sparkline: one series in ink (info or accent when the card's meaning calls for it, white on ink cards), a 10% area fill when `area` is set, and `highlightLast` for an accent end dot on risk rows only.
- BarList: the main ranking in ink with `emphasis` (accent) on the row the user filtered to; a secondary ranking in `tone="info"`.
- Part-to-whole: Donut segments and SegmentBar take explicit colours in a fixed order. Categorical order: ink, info, accent, warning, success, chart-muted. Outcome ramps read good to bad: `bg-success`, `bg-info`, `bg-warning`, `bg-accent` (good, rework, reject, scrap). Allocation ramps: `bg-info` from stock, `bg-ink` from production, `bg-silver` unresolved.
- Plans, targets and limits are reference lines, never a second series.
- A chart library in place of the kit's SVG charts (monitoring-system uses Recharts) takes the same colours from the `BRAND` mirror (branding.md): the series that needs action in accent (open alerts, security events), the settled one in ink (solved alerts, response times), a secondary series in a pale info blue (`#83B3EE`), each limit as a `4 4` dashed reference line in its series' colour. Its tooltip style reads the tokens too: `{ borderRadius: 16, border: \`1px solid ${BRAND.border}\`, boxShadow: BRAND.shadow, fontSize: 12 }`.

## Axes and scale
- Nice ticks on steps of 1, 2, 2.5, 5 and 10 (0 / 250 / 500), four by default; a flat series still gets a sensible domain; `yDomain` fixes it (percentages at 0 to 100).
- Gridlines: solid 1px `stroke-border` with `shapeRendering="crispEdges"`, one per tick. No axis lines, no tick marks.
- Tick labels `fill-muted text-[11px] tabular-nums`, right-aligned in a band whose width comes from the longest label (about 6.2px per character + 10px). The `format` prop formats both ticks and tooltips (`fmtNumber`, `fmtPercent`, `v => \`${v} h\``).
- X labels `fill-muted text-[11px] tabular-nums` centred under their point: the chart shows every n-th label anchored on the last one, clamps edge labels inside the plot, and skips a label that would touch its neighbour.
- Reference line: a 1px line in `stroke-muted` (or `stroke-warning` / `stroke-accent` for limits) with a right-aligned `fill-muted text-[11px]` label 5px above it.
- Zones (LineChart): horizontal bands at 8% opacity (`fill-success/8`, `fill-warning/8`, `fill-accent/8`) for the normal, warning and alarm ranges of a signal.

## Marks
- Columns: a 4px rounded data end and a square baseline end, at most 24px wide with a 2px gap, growing down from zero for negative values.
- Lines: 2px, round caps and joins, clipped to the plot. A `null` value breaks the line, so a day without data stays a gap instead of dropping to zero.
- Points: the last point always gets a dot (`r=4`, `stroke-card` ring of 2px) and a `text-[11px] font-semibold` value label; `showDots` marks every point; an isolated point always gets a dot.
- Donut: 148px with a 16px ring by default, starting at twelve o'clock, 2px gaps measured along the middle of the ring; the centre holds `text-2xl font-bold leading-none tracking-tight` over a `mt-1 text-[11px] font-medium text-muted` unit; an empty donut is a full `fill-surface` ring. The caller renders the legend.

## Interaction and accessibility
- Tooltip: an HTML bubble over the SVG with the value first and the label second: `pointer-events-none absolute z-10 whitespace-nowrap rounded-xl bg-ink px-2.5 py-1.5 text-xs leading-tight text-on-ink shadow-float`, value `font-semibold tabular-nums`, label `text-on-ink-muted`, 10px above the mark (below it when there is no room), clamped inside the chart width, `ring-1 ring-white/15` on dark cards.
- Line charts and sparklines use a crosshair: the pointer snaps to the nearest x and a 1px line marks it (`stroke-foreground/25` in LineChart, `stroke-border` in a Sparkline, `stroke-white/30` on ink), focus starts on the last point, arrow keys step, Home and End jump.
- Discrete marks (columns, bars, donut segments) get a transparent hit target the full height of their slot (at least 24px on a donut ring), one mark in the tab order, arrow keys to move focus, `opacity-80` on the hovered column, and a 3px outward lift on the hovered donut segment.
- The SVG is `role="img"` with an `ariaLabel` that names the measure ("Output per day, last 14 days"); an sr-only `aria-live="polite"` span echoes the hovered or focused value; focusable SVGs take `rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/40`.
- No data: `flex h-full items-center justify-center text-sm text-muted` "No data" at the chart's height. Rankings and legends switch to an `EmptyState compact` that says how to get data ("Widen the window or clear the filter").

## Chart card
One chart per card. The title names the measure and the grain ("Plan vs actual per day").
```tsx
<Card>
  <CardHeader action={<Combobox variant="inline" className="w-full sm:w-64" … />}>   {/* metric picker, or PillTabs size="sm" */}
    <CardTitle>Scrap rate per day</CardTitle>
    <p className="mt-0.5 text-xs text-muted">Scrap pieces over reported pieces, by shift date.</p>   {/* method line */}
  </CardHeader>
  <CardContent>
    <ColumnChart ariaLabel="Scrap rate per day" data={…} format={fmtPercent} referenceLine={{ value: target, label: 'Target 2%' }} height={220} />
    <p className="mt-3 text-xs text-muted">Highlighted days exceed the target.</p>   {/* footnote */}
  </CardContent>
</Card>
```
- Legend for a SegmentBar or Donut: rows `flex items-center justify-between gap-2 text-sm` with a `size-2 rounded-full` swatch and the label on the left, `text-muted tabular-nums` value and a `font-semibold text-foreground` count on the right; an exit link under it `mt-3 block text-xs font-semibold hover:text-accent` ("Open defects").
- Chart on a stat card: pass it as the StatCard's children (`mt-4 w-full`), a Sparkline at `height={40}` or a BarStrip at `height={56}`.
- Chart on an ink card: Sparkline `tone="white"`, BarStrip `onInk`.
- Drill-down: a clickable BarList row adds a filter chip to the page's filter bar and regroups one level finer; the row label may link to the record with `onClick={(e) => e.stopPropagation()}` and `hover:text-accent`.
- Part-to-whole example (CMMS work mix): Donut segments ink for planned, `chart-muted` for corrective and accent for emergency, the total in the centre over "work orders", and a `dl.space-y-2.5.text-sm` legend of rows with a `size-2.5 rounded-sm` swatch and muted label, the `font-semibold tabular-nums` count and a `w-11 text-right text-xs text-muted` share.

## Report chart card (Chart | Table, CMMS)
A review report pairs every chart with the same numbers as a table, so a reader who cannot use the chart, or who wants exact values, flips one toggle.
- Header `flex flex-wrap items-start justify-between gap-2 p-5`: the title column `flex min-w-[min(100%,16rem)] flex-1 basis-0 flex-col gap-1` holds the CardTitle and a CardDescription that states the counting rule ("Per month, cancelled work left out. The current month runs to today."); the controls `flex max-w-full flex-wrap items-center gap-2` end with `SegmentedControl size="sm"` Chart · Table (`aria-label="<title>: chart or table"`), its choice kept per card in history state.
- Table view: a compact table (`table.w-full.text-sm` with an sr-only caption; th `h-9 px-2 text-xs font-semibold uppercase tracking-wide text-muted first:pl-0 last:pr-0`; numeric columns `whitespace-nowrap text-right tabular-nums`; rows `border-b border-border last:border-b-0`; td `px-2 py-2`); columns past `phoneColumns` take `hidden sm:table-cell`, so a phone keeps two.
- Monthly series: `ColumnChart tone="muted"` with the current month as the highlighted column.
- The section's outline sm "Export CSV" writes every table in the section, and its toast names the file (`<site>-<section>-<date>.csv`).

## Page layout for analytics
1. `PageHeader` with the time window as `PillTabs size="sm"` (7, 14, 30 days) in its actions.
2. Filter bar `flex flex-wrap items-center justify-between gap-2`: on the left a `text-xs font-semibold text-muted` label and `PillTabs size="sm"` (group by); on the right the active drill-down as `Chip variant="filter" active icon={<X />}` that clears it.
3. KPI tiles `grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4`. Each tile's tone comes from its threshold (`toneByThreshold(value, good, fair, higherIsBetter)`, `default` when there is no standard); an odd last tile gets `col-span-2 xl:col-span-1`.
4. Time series `grid grid-cols-1 gap-4 xl:grid-cols-2`: one chart per row below `xl`, two from `xl`.
5. Ranking beside stacked side cards `grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`, the right cell `grid grid-cols-1 gap-4`.
6. Detail table beside a summary card `grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]`.
Insight and recommendation cards are in patterns.md.
