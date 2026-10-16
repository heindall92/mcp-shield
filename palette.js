// Design tokens shared by Tailwind and the contrast test.
// Dark is the reference theme; light mirrors every colour scale (50↔950, 100↔900 … 400↔600)
// and swaps white/black, so one set of class names gives two fully designed themes.
import colors from 'tailwindcss/colors.js'

export const FAMILIES = ['slate', 'red', 'amber', 'emerald', 'cyan', 'orange', 'violet', 'yellow']
export const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const MIRROR = Object.fromEntries(SHADES.map((s, i) => [s, SHADES[SHADES.length - 1 - i]]))
// slate-500 in light would sit on white at ~4.8:1; keep it, mirrors to itself.

export const SURFACES = {
  dark: { canvas: '#07090d', surface: '#0b0f16', elevated: '#0f141d', white: '#ffffff', black: '#000000' },
  light: { canvas: '#f4f5f7', surface: '#ffffff', elevated: '#ffffff', white: '#0f172a', black: '#ffffff' },
}

/** Resolve a token like "slate-400" | "white" | "surface" to hex in a theme. */
export function hex(token, theme) {
  if (token in SURFACES[theme]) return SURFACES[theme][token]
  const [fam, shade] = token.split('-')
  return colors[fam][theme === 'dark' ? shade : MIRROR[shade]]
}

const rgb = h => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}` }

/** CSS variables for one theme. */
export function cssVars(theme) {
  const v = {}
  for (const f of FAMILIES) for (const s of SHADES) v[`--${f}-${s}`] = rgb(hex(`${f}-${s}`, theme))
  for (const k of Object.keys(SURFACES[theme])) v[`--${k}`] = rgb(SURFACES[theme][k])
  return v
}

export function tailwindColors() {
  const c = { transparent: 'transparent', current: 'currentColor' }
  for (const f of FAMILIES) c[f] = Object.fromEntries(SHADES.map(s => [s, `rgb(var(--${f}-${s}) / <alpha-value>)`]))
  for (const k of Object.keys(SURFACES.dark)) c[k] = `rgb(var(--${k}) / <alpha-value>)`
  return c
}
