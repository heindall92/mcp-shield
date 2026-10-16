import type { MCPShieldSnapshot, MCPToolDefinition, IntegrityEvent, FieldChange } from '../domain/types'
import { canonicalize } from '../crypto/canonicalize'
import { byName } from '../crypto/hashes'
import { schemaDiff } from './schemaDiff'
import { findSmuggling } from '../../engine/rules/smugglingRules'
import { redactString, safeText } from '../../engine/redact'

/**
 * Snapshot Comparator (RFC-001 §7): comparability first, then per-tool events indexed by
 * (profileId, authContextId, toolName) with case-sensitive names.
 */
export interface Comparability { comparable: boolean; blockers: string[]; warnings: string[] }

export function comparability(a: MCPShieldSnapshot, b: MCPShieldSnapshot): Comparability {
  const blockers: string[] = [], warnings: string[] = []
  if (a.target.profileId !== b.target.profileId) blockers.push('profileId')
  if (a.target.authContextId !== b.target.authContextId) blockers.push('authContextId')
  if (a.target.transport !== b.target.transport) blockers.push('transport')
  if (a.capture.completeness === 'invalid' || b.capture.completeness === 'invalid') blockers.push('completeness')
  if (a.target.protocolVersion !== b.target.protocolVersion) warnings.push('protocolVersion')
  if (b.capture.completeness === 'partial') warnings.push('partial')
  if (b.capture.completeness === 'claimed-complete' || a.capture.completeness === 'claimed-complete') warnings.push('claimed-complete')
  if (a.target.serverLabel !== b.target.serverLabel) warnings.push('serverLabel')
  if (a.capture.completeness === 'partial') warnings.push('provisional-baseline')
  return { comparable: blockers.length === 0, blockers, warnings }
}

const MAX_SHOW = 600
/** Display-safe text: redacted, invisible code points visible, capped. Never rendered as HTML. */
export const show = (v: unknown) => { const s = typeof v === 'string' ? v : v === undefined ? '' : canonicalize(v); return safeText(redactString(s)).replace(/[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]/gu, ch => `⟨U+${ch.codePointAt(0)!.toString(16).toUpperCase()}⟩`).slice(0, MAX_SHOW) }

/** Invisible-payload signal for a tool: everything the model reads. */
export function invisibles(t: MCPToolDefinition) {
  const text = [t.name, t.title ?? '', t.description ?? '', canonicalize(t.inputSchema), t.outputSchema ? canonicalize(t.outputSchema) : '', t.annotations ? canonicalize(t.annotations) : ''].join('\n')
  const hits = findSmuggling(text)
  const zw = (text.match(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g) ?? []).length
  return { count: hits.reduce((n, h) => n + h.count, 0) + zw, hidden: hits.map(h => h.hidden).filter(Boolean).join(' '), kinds: [...hits.map(h => h.kind), ...(zw ? ['zero-width'] : [])] }
}

const same = (a: unknown, b: unknown) => (a === undefined && b === undefined) || (a !== undefined && b !== undefined && canonicalize(a) === canonicalize(b))
const ch = (path: string, a: unknown, b: unknown): FieldChange => ({ path, before: a === undefined ? undefined : show(a), after: b === undefined ? undefined : show(b) })

export function diffTool(a: MCPToolDefinition, b: MCPToolDefinition, protocolChanged: boolean): IntegrityEvent[] {
  if (canonicalize(a) === canonicalize(b)) return []
  const ev: IntegrityEvent[] = []
  const conf = protocolChanged ? 'medium' as const : 'high' as const
  const text: FieldChange[] = []
  if (!same(a.title, b.title)) text.push(ch('title', a.title, b.title))
  if (!same(a.description, b.description)) text.push(ch('description', a.description, b.description))
  if (text.length) ev.push({ type: 'DESCRIPTION_CHANGED', tool: b.name, changes: text, confidence: conf, notes: [] })
  const ia = invisibles(a), ib = invisibles(b)
  if (ib.count > ia.count) ev.push({ type: 'INVISIBLE_PAYLOAD', tool: b.name, confidence: ib.hidden.length >= 3 || ib.kinds.includes('tags') ? 'high' : 'medium',
    changes: [{ path: 'invisible', before: String(ia.count), after: String(ib.count) }, ...(ib.hidden ? [{ path: 'decoded', after: show(ib.hidden) }] : [])], notes: ib.kinds })
  if (!same(a.inputSchema, b.inputSchema)) {
    const d = schemaDiff(a.inputSchema, b.inputSchema)
    const pick = (p: string) => ch(p, getPath(a.inputSchema, p), getPath(b.inputSchema, p))
    if (d.expanded.length) ev.push({ type: 'INPUT_EXPANDED', tool: b.name, confidence: conf, changes: d.expanded.slice(0, 20).map(pick), notes: d.restricted.length ? ['also-restricted'] : [] })
    const other = [...d.restricted, ...d.unknown, ...d.headers.map(h => `${h}.x-mcp-header`)]
    if (other.length) ev.push({ type: 'SCHEMA_CHANGED', tool: b.name, confidence: d.unknown.length ? 'low' : conf, changes: other.slice(0, 20).map(pick),
      notes: [...(d.restricted.length ? ['breaking'] : []), ...(d.unknown.length ? ['unknown'] : []), ...(d.headers.length ? ['x-mcp-header'] : [])] })
    if (!d.expanded.length && !other.length) ev.push({ type: 'SCHEMA_CHANGED', tool: b.name, confidence: conf, changes: [ch('inputSchema', a.inputSchema, b.inputSchema)], notes: ['compatible'] })
  }
  if (!same(a.outputSchema, b.outputSchema)) ev.push({ type: 'SCHEMA_CHANGED', tool: b.name, confidence: conf, changes: [ch('outputSchema', a.outputSchema, b.outputSchema)], notes: ['outputSchema'] })
  const ann: FieldChange[] = []
  const keys = new Set([...Object.keys(a.annotations ?? {}), ...Object.keys(b.annotations ?? {})])
  for (const k of keys) if (!same(a.annotations?.[k], b.annotations?.[k])) ann.push(ch(`annotations.${k}`, a.annotations?.[k], b.annotations?.[k]))
  if (!same(a.icons, b.icons)) ann.push(ch('icons', a.icons, b.icons))
  if (ann.length) ev.push({ type: 'ANNOTATION_CHANGED', tool: b.name, confidence: conf, changes: ann, notes: ['hints-not-controls'] })
  const unk: FieldChange[] = []
  if (!same(a._meta, b._meta)) unk.push(ch('_meta', a._meta, b._meta))
  if (!same(a.extensions, b.extensions)) unk.push(ch('extensions', a.extensions, b.extensions))
  if (unk.length) ev.push({ type: 'INTEGRITY_MISMATCH', tool: b.name, confidence: 'medium', changes: unk, notes: ['unknown-fields'] })
  if (!ev.length) ev.push({ type: 'INTEGRITY_MISMATCH', tool: b.name, confidence: 'low', changes: [], notes: ['unclassified'] })
  return ev
}

function getPath(s: unknown, p: string): unknown {
  let cur: unknown = s
  for (const part of p.replace(/^inputSchema\.?/, '').replace(/ \(.*\)$/, '').split('.').filter(Boolean)) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export interface Comparison { comparability: Comparability; events: IntegrityEvent[]; unconfirmedMissing: string[] }

export function compare(baseline: MCPShieldSnapshot, candidate: MCPShieldSnapshot): Comparison {
  const c = comparability(baseline, candidate)
  if (!c.comparable) return { comparability: c, unconfirmedMissing: [], events: [{ type: 'CONTEXT_MISMATCH', confidence: 'high', notes: c.blockers,
    changes: c.blockers.map(k => k === 'completeness' ? ch('capture.completeness', baseline.capture.completeness, candidate.capture.completeness) : ch(`target.${k}`, (baseline.target as unknown as Record<string, string>)[k], (candidate.target as unknown as Record<string, string>)[k])) }] }
  const A = new Map(baseline.tools.map(t => [t.name, t])), B = new Map(candidate.tools.map(t => [t.name, t]))
  const events: IntegrityEvent[] = []
  const pv = c.warnings.includes('protocolVersion')
  for (const t of [...candidate.tools].sort(byName)) {
    const a = A.get(t.name)
    if (!a) {
      const iv = invisibles(t)
      // With a provisional (partial) baseline the tool may simply not have been captured before.
      const prov = baseline.capture.completeness === 'partial'
      events.push({ type: 'TOOL_ADDED', tool: t.name, confidence: prov ? 'low' : 'high', changes: [ch('description', undefined, t.description ?? '')], notes: prov ? ['provisional-baseline'] : [] })
      if (iv.count) events.push({ type: 'INVISIBLE_PAYLOAD', tool: t.name, confidence: iv.hidden.length >= 3 || iv.kinds.includes('tags') ? 'high' : 'medium', changes: [{ path: 'invisible', before: '0', after: String(iv.count) }, ...(iv.hidden ? [{ path: 'decoded', after: show(iv.hidden) }] : [])], notes: iv.kinds })
    } else events.push(...diffTool(a, t, pv))
  }
  const complete = candidate.capture.completeness === 'pagination-complete' || candidate.capture.completeness === 'claimed-complete'
  const missing = [...A.keys()].filter(n => !B.has(n)).sort()
  if (complete) for (const n of missing) events.push({ type: 'TOOL_REMOVED', tool: n, confidence: candidate.capture.completeness === 'claimed-complete' ? 'medium' : 'high', changes: [ch('description', A.get(n)!.description ?? '', undefined)], notes: [] })
  return { comparability: c, events, unconfirmedMissing: complete ? [] : missing }
}
