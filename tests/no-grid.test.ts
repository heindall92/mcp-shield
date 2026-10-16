import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Decorative background grids, dot grids and line patterns are forbidden in every view and theme.
const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? files(p) : /\.(css|tsx?|html)$/.test(f) ? [p] : []
})
const FORBIDDEN: [string, RegExp][] = [
  ['background-size', /background-size/i],
  ['SVG <pattern>', /<pattern[\s>]/i],
  ['repeating gradient', /repeating-(linear|radial|conic)-gradient/i],
  ['hairline gradient grid', /gradient\([^)]*\b1px\s*,\s*transparent\s+1px/i],
  ['grid background class', /\b(grid-bg|bg-grid|dot-grid|bg-dots)\b/],
  ['tailwind bg-size utility', /\bbg-\[size:/],
  ['kit dot grid / tick rulers in figures', /\b(dotGrid|topTicks|sideTicks|radialTicks)\(/],
]
// The vendored kit defines (but we never call) its tick and dot-grid helpers.
const scanned = [...files('src'), 'index.html'].filter(f => !f.endsWith('iso-kit.ts'))

describe('no decorative grid backgrounds', () => {
  it.each(FORBIDDEN)('nothing uses %s', (_n, re) => {
    const hits = scanned.filter(f => re.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})
