import { SECRET_PATTERNS, REDACTED } from './redact'

/**
 * Final safety gate: every export (SARIF, Markdown, hardened config, Dockerfile/compose, clipboard)
 * is scanned for leftover credentials before it can leave the page. Hits carry only a kind and a line
 * number, never the value.
 */
export interface GateHit { kind: string; line: number }
export interface GateResult { ok: boolean; hits: GateHit[] }

const entropy = (s: string) => {
  const f = new Map<string, number>()
  for (const c of s) f.set(c, (f.get(c) ?? 0) + 1)
  let h = 0
  for (const n of f.values()) { const p = n / s.length; h -= p * Math.log2(p) }
  return h
}
/** Random-looking token: long, mixed classes and high Shannon entropy. */
export function highEntropy(tok: string): boolean {
  if (tok.length < 20 || tok.length > 512) return false
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter(r => r.test(tok)).length
  if (classes < 3) return false
  if (/^[A-Za-z]+(-[A-Za-z]+)+-?\d*$/.test(tok)) return false // kebab words
  return entropy(tok) >= 3.6
}

export function gate(text: string): GateResult {
  const hits: GateHit[] = []
  const lines = text.split('\n')
  lines.forEach((ln, i) => {
    const line = i + 1
    for (const p of SECRET_PATTERNS) { p.re.lastIndex = 0; const m = ln.match(p.re); if (m && !m.every(x => x.includes(REDACTED) || x.includes('…'))) hits.push({ kind: p.name, line }) }
    if (/[a-z][a-z0-9+.-]*:\/\/[^\s:/@"']+:(?!\[REDACTED\]|\$\{)[^\s@/"']+@/i.test(ln)) hits.push({ kind: 'URL credentials', line })
    if (/\b(Bearer|Basic)\s+(?!\[REDACTED\]|\$\{|<)[A-Za-z0-9._~+/=-]{12,}/.test(ln)) hits.push({ kind: 'Authorization header', line })
    for (const m of ln.matchAll(/[A-Za-z0-9+/_=-]{20,}/g)) if (highEntropy(m[0])) { hits.push({ kind: 'high-entropy string', line }); break }
  })
  return { ok: hits.length === 0, hits: hits.slice(0, 20) }
}
