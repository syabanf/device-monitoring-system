/**
 * Hex values of the theme tokens, for the places a CSS class cannot reach: chart libraries,
 * map markers and hand-drawn SVG. They mirror packages/tailwind-config/theme.css, so a chart
 * changes colour with the rest of the app when the theme does.
 */
export const BRAND = {
  ink: '#004a94',
  accent: '#e31e24',
  highlight: '#ffd100',
  muted: '#8a94a3',
  border: '#e3e8ef',
  shadow: '0 12px 40px -12px rgb(0 40 90 / 0.3)',
} as const;

/** Colours an admin can give a person's avatar: the two brand colours first, then calm neutrals. */
export const AVATAR_COLORS = [BRAND.ink, BRAND.accent, '#1d4ed8', '#047857', '#b45309', '#6d28d9', '#0e7490', '#be185d'];
