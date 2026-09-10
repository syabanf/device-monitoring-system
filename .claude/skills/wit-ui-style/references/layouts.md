# Layout shells

## Admin shell
```tsx
<div className="flex h-dvh gap-4 overflow-hidden bg-surface p-3 lg:p-4">
  <div className="hidden shrink-0 lg:block"><Rail …/></div>          {/* floating dark rail */}
  <Sheet side="left" className="w-72 bg-ink p-0"><DrawerNav/></Sheet> {/* < lg */}
  <div className="flex min-w-0 flex-1 flex-col gap-4">
    <header className="flex h-14 shrink-0 items-center gap-3">
      <Button variant="ghost" size="icon" className="bg-card shadow-card lg:hidden"><Menu/></Button>
      <div className="hidden min-w-0 md:block"><h2 className="truncate text-lg font-bold leading-tight">{title}</h2><p className="truncate text-xs text-muted">{context}</p></div>
      <form className="ml-auto w-full max-w-sm md:ml-6 md:mr-auto"><Input leftIcon={<Search/>} className="[&_input]:h-11 [&_input]:rounded-full [&_input]:border-0 [&_input]:bg-card [&_input]:shadow-card"/></form>
      <Button className="hidden sm:inline-flex"><Plus/>Primary action</Button>
      <Button variant="ghost" size="icon" className="relative bg-card shadow-card"><Bell/><span className="absolute right-2 top-2 size-2 rounded-full bg-accent ring-2 ring-card"/></Button>
      <button className="flex h-11 items-center gap-2.5 rounded-full bg-card pl-1.5 pr-3 shadow-card"><Avatar size="sm"/><span className="hidden xl:block …">name / email</span></button>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto pb-2 pr-0.5"><Outlet/></main>
  </div>
</div>
```
Rail: `aside flex h-full flex-col rounded-[28px] bg-ink py-4 text-on-ink shadow-float transition-[width]`; collapsed `w-[76px] items-center`, expanded `w-60 px-3`. Header tile `size-11 rounded-2xl bg-white/5` with the wordmark. Items `relative flex items-center rounded-2xl text-on-ink-muted hover:bg-white/10 hover:text-white data-[active=true]:bg-accent data-[active=true]:text-white data-[active=true]:shadow-glow [&_svg]:size-5`; collapsed `size-11 justify-center` (tooltip on the right), expanded `h-11 w-full gap-3 px-3`; sub-items `h-9 pl-11 text-[13px]`. Groups collapse with a chevron. Footer: alerts item with count badge, sign-out, then the collapse toggle. Persist expanded state in localStorage.

Page body: `space-y-4`; `PageHeader` = `mb-6 flex flex-wrap items-start justify-between gap-3` with `h1 text-2xl font-bold tracking-tight` + `p mt-1 text-sm text-muted` and an actions cluster (search input `w-72` + primary button).
Grids: hero `grid gap-4 lg:grid-cols-[1.5fr_1fr]`; stat rows `grid gap-4 sm:grid-cols-3`; two-column detail `grid gap-4 lg:grid-cols-2` or `xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]`.

## Mobile PWA shell
```tsx
<div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
  <main className="flex-1 px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-32"><Outlet/></main>   {/* pb-8 on detail screens */}
  <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md">
    <div className="pointer-events-none h-8 bg-gradient-to-t from-surface to-transparent"/>
    <div className="safe-b rounded-t-[28px] bg-card shadow-[0_-10px_30px_-14px_rgba(16,17,18,0.25)]">
      <div className="flex items-stretch px-3 pb-2 pt-2">
        {/* per tab */}
        <Link className="group flex flex-1 flex-col items-center justify-center gap-1 py-1.5">
          <span className={active ? 'relative flex h-9 w-14 items-center justify-center rounded-full bg-accent text-white shadow-glow' : 'relative flex h-9 w-14 items-center justify-center rounded-full text-muted group-active:bg-surface'}>
            <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2}/> {/* + count badge absolute -right-1 -top-1 */}
          </span>
          <span className={active ? 'text-[11px] font-semibold text-accent' : 'text-[11px] font-semibold text-muted'}>{label}</span>
        </Link>
      </div>
    </div>
  </nav>
</div>
```
Screen header: `flex items-center justify-between pt-3` → left `p text-sm text-muted` (greeting/context) + `h1 mt-0.5 text-[28px] font-bold leading-tight tracking-tight` ending in `<span className="text-accent">.</span>`; right `Avatar size-12 shadow-card ring-4 ring-card`.
Detail header: round back button `size-11 rounded-full bg-card shadow-card active:scale-95` + `h1 text-lg font-bold leading-tight` + `p text-xs text-muted`; tab bar hidden.
Login: centered column `px-6 pb-10 pt-16`, wordmark, `text-3xl font-bold` title with accent period, inputs `h-12`, primary `size lg w-full`, demo hint in `text-xs text-muted`.
Sticky bottom CTA on forms: `pb-28` on the form + fixed primary button if needed.

## Responsive rules (admin)

Three tiers, Tailwind breakpoints: **phone `< md` (375 reference)**, **tablet `md–xl` (768 / 1024)**, **desktop `≥ xl`**.

| Element | Phone | Tablet | Desktop |
|---|---|---|---|
| Nav | left drawer `Sheet` (`w-72 bg-ink`) + round menu button in header | collapsed icon rail `w-[76px]` | rail, expandable to `w-60` |
| Header | menu · search icon button (`ml-auto`) · bell · avatar (avatar text `hidden xl:block`); search opens as a full-width row under the header (`-mt-2 md:hidden`) | pill search `hidden md:block flex-1 min-w-0` + primary CTA `hidden sm:inline-flex` | same |
| Canvas padding | `p-3` | `p-3` | `lg:p-4` |
| Hero grid | 1 col | 1 col | `xl:grid-cols-[1.5fr_1fr]` |
| Mini stat tiles (attention) | `grid-cols-3`, content stacked (`flex-col sm:flex-row`), arrow `hidden sm:block` | 3-up row | 1 col beside the alerts card (`xl:grid-cols-1`) |
| Small stat pair (temp / devices) | `grid-cols-2 gap-3` | `gap-4` | same |
| 3 stat cards | swipeable snap row: `flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&>*]:min-w-[72%] [&>*]:snap-start` | `sm:grid sm:grid-cols-3` | same |
| List columns + analysis | stacked | `md:grid-cols-2`, analysis `md:col-span-2` | `xl:grid-cols-[1fr_1fr_20rem]`, analysis `xl:col-span-1` |
| Summary strip | stacked | `sm:grid-cols-2`, CTA `sm:justify-self-end` | `xl:grid-cols-[1.4fr_1fr_1fr_auto]` |
| List row status | compact line under subtitle (`mt-1.5 flex gap-2 sm:hidden`) | right column `hidden sm:flex flex-col items-end` | same |
| Captions ("Point of view…") | `hidden md:block` | shown | shown |

Hard rules
- **`grid-cols-1` base on every breakpoint-only grid.** `grid gap-4 xl:grid-cols-[…]` alone lets the implicit `auto` track grow to the widest `whitespace-nowrap` child and the page scrolls sideways.
- Flex rows that hold a button on the right (`justify-between`) get `flex-wrap gap-2` so the button drops below on phones instead of clipping.
- Banners: `flex flex-wrap items-center gap-3`, text `min-w-[12rem] flex-1`.
- No negative-margin bleed (`-mx-3`) inside the admin `main` — it is a scroll container and the bleed becomes horizontal scroll. Bleed rows (`-mx-5 px-5`) are for the mobile PWA only.
- Verify: at 375 and 768, `document.querySelector('main').scrollWidth === clientWidth` and no element's `getBoundingClientRect().right > innerWidth` (ignoring `overflow-hidden` decor). Real device emulation is required — a desktop Chrome window cannot go below ~500px, so a "390px" headless screenshot is a cropped wider layout.

