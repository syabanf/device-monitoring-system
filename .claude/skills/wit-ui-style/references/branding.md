# Branding: map a client palette onto the tokens

The layout is the house style; the colours come from the client. monitoring-system changed palettes
twice in one day (WIT red, then a guessed Indomaret palette, then colours sampled from the Indomaret
logo). These steps held up; the Indomaret values serve as the worked example.

## 1. Sample the colours from the logo
Ask the client for the logo file and read its colours with a picker or a script. The first
Indomaret pass used remembered values (blue `#004A94`, red `#E31E24`, yellow `#FFD100`); the logo
turned out to be `#006AB3`, `#D61D25` and `#FFCF20`, and every token, icon and constant moved again.

## 2. Assign roles

| Brand colour | Token | Test |
|---|---|---|
| the darkest saturated colour (often a blue) | `ink` | white text on it ≥ 4.5:1 (Indomaret blue: 5.66) |
| the hot colour (red, orange) | `accent` | white text on `accent-strong`, the solid fill behind small white text, ≥ 4.5:1 (Indomaret: 6.89; the logo red itself reaches 5.17) |
| a third colour (yellow, green) | `highlight` | carries no text and no state: app-icon stripe, logo stripe, the selected ring on a map |

A one-colour brand gives the accent and keeps the near-black ink. A brand colour that fails the
white-text test stays in the logo and icons, and a darker step of it becomes the token.

## 3. Derive the rest

- `ink-2`, `ink-3` (inset panel, hover): small steps from the ink that keep white text at 4.5:1. The Indomaret `ink-3` `#1A84CC` drops to 4.03; a darker step such as `#005C9C` holds 6.97.
- `on-ink-muted`: a pale tint of the ink hue. A mid-tone ink leaves little room for dimmed text: on `#006AB3` the floor for 4.5:1 is `#D9E8F7` (the shipped `#BCD8F2` reaches 3.84). Separate rail and hero hierarchy by size and weight.
- Neutral ladder: tint canvas, borders and text toward the ink hue at low saturation. Indomaret: surface `#F2F5F9`, surface-2 `#F6F8FB`, border `#E3E8EF`, silver `#B8C2CE`, muted `#5F6B7A` (4.96:1 on surface), body `#2B3440`, foreground `#0E1A2B`.
- Shadows: swap the shadow colour for a deep shade of the ink hue (`rgb(0 55 110 / 0.04 · 0.14 · 0.3)` for the Indomaret blue).
- Accent family: `accent-strong` about 12% darker for solid fills behind small white text (Indomaret `#B3161D`, 6.89:1 with white), `accent-dark` about 25% darker for its hover (`#93151B`), `accent-soft` a 6–8% tint (`#FDF1F1`).
- `info`: a lighter step of a blue ink (`#1763BF` on `#EDF5FE`); with a non-blue ink, a calm blue.
- Accent on ink: red on the Indomaret blue measures 1.09:1, so accent never appears as text or an icon on a coloured ink. On ink it stays a solid fill with white content (active tile, count badge, the round create button), and a title period on ink turns `highlight` (3.82:1 at display size) or white.

## 4. Mirror the tokens for code that cannot read classes
Chart libraries, map markers, hand-drawn SVG and inline `style` props take their colours from one
constant in the UI kit. Keep it in step with theme.css:

```ts
// packages/ui/src/lib/brand.ts
export const BRAND = {
  ink: '#006ab3',
  accent: '#d61d25',
  highlight: '#ffcf20',
  muted: '#8a94a3',
  border: '#e3e8ef',
  shadow: '0 12px 40px -12px rgb(0 55 110 / 0.3)',
} as const;

/** Avatar colours an admin can pick: the two brand colours first, then calm hues. */
export const AVATAR_COLORS = [BRAND.ink, BRAND.accent, '#1d4ed8', '#047857', '#b45309', '#6d28d9', '#0e7490', '#be185d'];
```

Colour semantics outside the class system: the series or marker that needs action takes the accent
(open alerts, security events); the settled one takes ink (solved alerts, response times); offline
takes `BRAND.muted`; a secondary series takes a pale info blue (`#83B3EE`); a selected map marker
gets a 3px `highlight` ring. A new avatar or technician defaults to `BRAND.ink`.

## 5. The logo
- Bundle the client's file through an import in the UI kit (`packages/ui/src/assets/`, webp, about 640px wide and 20KB) so the bundler content-hashes it; declare the module type in an `assets.d.ts`. Set `width`, `height`, `alt` and `draggable={false}`.
- `BrandMark` shows it bare on white (`w-36` on a phone login, `w-28` in a wizard header). On ink the logo's own colours can vanish, so `plate` sets it on a white tile, `rounded-xl bg-white p-1.5 shadow-card`: rail header `[&_img]:w-24`, login hero `[&_img]:w-40`, collapsed rail `compact` (`w-9` inside a `size-11 p-1` plate).
- Drop any label the wider logo pushes out. The monitoring-system rail lost its "Monitoring" caption, which ended up under the create button.
- Until the file arrives, stand in with a text wordmark in the brand colours, and swap it out on the day the file lands.

## 6. App icons and browser chrome
- Favicon and PWA icons: an ink tile with about 22% corner radius (`rx="112"` on 512), the product glyph in white (monitoring-system: the alert bell), and a two-colour brand stripe along the bottom (accent + highlight). Export `icon.svg`, `icon-maskable.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` and `apple-touch-icon.png`.
- `<meta name="theme-color">` and the manifest `theme_color` take the ink.
- Credits put the client's product first and the vendor second: "Outlet environment monitoring · built by WIT.ID".

## 7. After the swap, search for literal colours
A class or constant that spells a colour out stays on the old palette. After a palette change,
search `rgb(`, `rgba(`, `#` + hex and the old brand hex values in class strings and TS, and route
each hit through a token (`shadow-glow`, `bg-accent/30`) or `BRAND`. Search the backend too:
defaults such as an avatar colour live in API code. monitoring-system's switch missed nine accent
glows written as `rgb(237 28 36 / …)` (the WIT red) in the primary button, the rail action and
items, the phone bars and the ambient canvas glow, the pale pink mixed from that red in the same
glow, one `rgba(16,17,18,0.25)` tab-bar shadow, and the API's default avatar colour `#101112`.

## 8. Contrast gate (run before building screens)

| Pair | Minimum | Indomaret |
|---|---|---|
| white on `ink` | 4.5:1 | 5.66 |
| white on `accent-strong` | 4.5:1 | 6.89 |
| `on-ink-muted` on `ink` | 4.5:1 | 3.84, fails: raise to `#D9E8F7` |
| `muted` on `surface` | 4.5:1 | 4.96 |
| `accent-strong` on `accent-soft` (error text on its tint) | 4.5:1 | 6.24 |
| `accent` on `ink` | never used as text | 1.09 |

A small script settles it: compute relative luminance per WCAG 2.x and print each ratio. Keep the
table in the project README beside the palette.
