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
// Design guide: 4 hues. Slate is the neutral, red is the single saturated accent (injection / danger).
// Emerald (safe), amber (warning) and cyan (focus / info) are toned down by blending toward slate;
// orange, yellow and violet are folded into amber / slate so no extra hues appear.
export const HUES = ['slate', 'red', 'amber', 'emerald', 'cyan']
const ALIAS = { orange: 'amber', yellow: 'amber', violet: 'slate' }
const MUTE = { emerald: 0.3, amber: 0.25, cyan: 0.4 }
const blend = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')

export function hex(token, theme) {
  if (token in SURFACES[theme]) return SURFACES[theme][token]
  const [fam0, shade] = token.split('-')
  const fam = ALIAS[fam0] ?? fam0
  const s = theme === 'dark' ? shade : MIRROR[shade]
  // Muted text (slate-400) is nudged so it reaches ~7:1 on every surface in both themes.
  if (fam === 'slate' && shade === '400') return theme === 'dark' ? blend(colors.slate[400], colors.slate[300], 0.25) : blend(colors.slate[600], colors.slate[700], 0.35)
  const base = colors[fam][s]
  return MUTE[fam] ? blend(base, colors.slate[s], MUTE[fam]) : base
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
  c.accent = { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', strong: 'rgb(var(--accent-strong) / <alpha-value>)', ink: 'rgb(var(--accent-ink) / <alpha-value>)' }
  return c
}

/* Accents shared by the ecosystem (Rosetta's seven, electric blue by default). Brand only: primary
 * button, active navigation, focus, kickers and logo. Meaning (danger, safe, warning) never uses them. */
export const ACCENTS = {
  azul: { dark: ['#6b9bff', '#9dbdff', '#041226'], light: ['#1a4fe0', '#123db8', '#ffffff'] },
  rosa: { dark: ['#ff7ab8', '#ffc0de', '#3b0620'], light: ['#b8155a', '#9a0f4a', '#ffffff'] },
  solar: { dark: ['#ffb020', '#ffd27a', '#2a1600'], light: ['#8a4a00', '#703c00', '#ffffff'] },
  glaciar: { dark: ['#5ee7f5', '#b6f6ff', '#042028'], light: ['#0a6a7d', '#085968', '#ffffff'] },
  orquidea: { dark: ['#b79bff', '#ddd0ff', '#1a0838'], light: ['#5b35f0', '#4a22d6', '#ffffff'] },
  verde: { dark: ['#5aa86a', '#8fd4a0', '#06210f'], light: ['#1a6b36', '#12552a', '#ffffff'] },
  rojo: { dark: ['#ff6b6b', '#ffb0b0', '#2a0808'], light: ['#b3141a', '#930f14', '#ffffff'] },
}
export const DEFAULT_ACCENT = 'azul'
export function accentVars(id, theme) {
  const [a, s, ink] = ACCENTS[id][theme]
  return { '--accent': rgb(a), '--accent-strong': rgb(s), '--accent-ink': rgb(ink) }
}
/** Base CSS for every accent × theme; no data-accent means electric blue. */
export function accentRules() {
  const r = { ':root': accentVars(DEFAULT_ACCENT, 'dark'), ':root.light': accentVars(DEFAULT_ACCENT, 'light') }
  for (const id of Object.keys(ACCENTS)) { r[`:root[data-accent="${id}"]`] = accentVars(id, 'dark'); r[`:root.light[data-accent="${id}"]`] = accentVars(id, 'light') }
  return r
}
