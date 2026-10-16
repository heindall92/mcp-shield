import { describe, it, expect } from 'vitest'
// @ts-expect-error plain JS module shared with tailwind.config.js
import { hex } from '../palette.js'

type Theme = 'dark' | 'light'
const toRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const lum = (h: string) => { const [r, g, b] = toRgb(h).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const mix = (top: string, a: number, under: string) => '#' + toRgb(top).map((v, i) => Math.round(v * a + toRgb(under)[i] * (1 - a)).toString(16).padStart(2, '0')).join('')
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

/** [foreground, base surface, optional tint over the base, minimum ratio, where it is used] */
type Pair = [string, string, [string, number] | null, number, string]
const TEXT = 4.5, UI = 3
const PAIRS: Pair[] = [
  ['slate-200', 'canvas', null, TEXT, 'body text'],
  ['white', 'surface', null, TEXT, 'headings'],
  ['slate-300', 'surface', null, TEXT, 'panel copy / terminal output'],
  ['slate-400', 'surface', null, TEXT, 'muted text, kickers, mono labels'],
  ['slate-400', 'canvas', null, TEXT, 'footer, muted on page'],
  ['slate-400', 'elevated', null, TEXT, 'modal muted'],
  ['slate-400', 'surface', ['white', 0.035], TEXT, 'muted inside cards'],
  ['slate-300', 'surface', ['black', 0.2], TEXT, 'JSON-RPC code blocks'],
  ['cyan-300', 'surface', null, TEXT, 'links'],
  ['red-200', 'surface', ['red-400', 0.07], TEXT, 'terminal alert'],
  ['red-200', 'surface', ['red-400', 0.14], TEXT, 'injection highlight / critical chip'],
  ['emerald-200', 'surface', ['emerald-400', 0.14], TEXT, 'blocked highlight'],
  ['emerald-300', 'surface', null, TEXT, 'mitigation headings / lessons'],
  ['amber-200', 'surface', ['amber-400', 0.12], TEXT, 'medium chip / evidence'],
  ['orange-200', 'surface', ['orange-400', 0.14], TEXT, 'high chip'],
  ['slate-300', 'surface', ['slate-400', 0.14], TEXT, 'low chip'],
  ['white', 'red-600', null, TEXT, 'impact banner'],
  ['emerald-950', 'emerald-300', null, TEXT, 'hardened banner'],
  ['slate-950', 'slate-50', null, TEXT, 'primary button'],
  ['red-200', 'canvas', ['red-400', 0.14], TEXT, 'Vulnerable segment'],
  ['emerald-200', 'canvas', ['emerald-400', 0.14], TEXT, 'Hardened segment'],
  ['amber-100', 'surface', ['amber-200', 0.07], TEXT, 'active graph chip label/icon'],
  ['cyan-400', 'canvas', null, UI, 'focus ring'],
  ['red-400', 'surface', null, UI, 'danger dot / score ring'],
  ['emerald-400', 'surface', null, UI, 'verified dot'],
  ['amber-300', 'surface', null, UI, 'illustrative dot / active step'],
  ['slate-400', 'surface', null, UI, 'icons, idle graph nodes'],
]

describe.each(['dark', 'light'] as Theme[])('WCAG AA contrast — %s theme', theme => {
  it.each(PAIRS)('%s on %s (%s) ≥ %s — %s', (fg, base, tint, min) => {
    const b = hex(base, theme)
    const bg = tint ? mix(hex(tint[0], theme), tint[1], b) : b
    expect(ratio(hex(fg, theme), bg)).toBeGreaterThanOrEqual(min)
  })
})
