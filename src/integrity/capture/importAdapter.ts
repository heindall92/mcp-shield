import type { MCPShieldSnapshot, MCPToolDefinition, SnapshotTarget, CaptureCompleteness, CaptureSource } from '../domain/types'
import { LIMITS, jsonDepth, type Issue, type Limits } from './limits'

/**
 * Capture Adapter + Snapshot Validator (RFC-001 §3, §5).
 * Accepts: a single tools/list JSON-RPC response, a set of pages (array, or {pages:[…]}, optionally
 * {request,response} pairs), or a native MCPShieldSnapshot 1.0 file. Pure and synchronous: safe to run in a Worker.
 * Never resolves $ref, never loads icons, never normalises Unicode.
 */
export interface ImportContext extends SnapshotTarget { source?: CaptureSource }
export interface ImportResult { snapshot?: MCPShieldSnapshot; issues: Issue[]; kind?: 'native' | 'jsonrpc' | 'pages' }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const KNOWN = new Set(['name', 'title', 'description', 'inputSchema', 'outputSchema', 'annotations', 'icons', '_meta', 'extensions'])
const TRANSPORTS = new Set(['stdio', 'streamable-http'])
const COMPLETENESS = new Set(['pagination-complete', 'claimed-complete', 'partial', 'invalid'])
/** Protocol revisions this monitor knows (verified against modelcontextprotocol.io/specification/versioning on 2026-10-16). */
export const KNOWN_PROTOCOLS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `snap-${Date.now().toString(36)}`)

function walkRefs(v: unknown, at: string, issues: Issue[], depth = 0) {
  if (depth > LIMITS.maxDepth) return
  if (Array.isArray(v)) v.forEach((x, i) => walkRefs(x, `${at}[${i}]`, issues, depth + 1))
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) {
    if (k === '$ref' && typeof x === 'string' && !x.startsWith('#')) issues.push({ code: 'external-ref', level: 'warning', at: `${at}.$ref` })
    walkRefs(x, `${at}.${k}`, issues, depth + 1)
  }
}

/** Normalise one tool into the contract shape. Unknown keys go to `extensions`; nothing is rewritten. */
function toTool(raw: unknown, at: string, issues: Issue[]): MCPToolDefinition | undefined {
  if (!isObj(raw) || typeof raw.name !== 'string' || raw.name === '') { issues.push({ code: 'tool-shape', level: 'error', at }); return undefined }
  if (!isObj(raw.inputSchema)) { issues.push({ code: 'tool-shape', level: 'error', at: `${at}.inputSchema` }); return undefined }
  const t: MCPToolDefinition = { name: raw.name, inputSchema: raw.inputSchema }
  if (typeof raw.title === 'string') t.title = raw.title
  if (typeof raw.description === 'string') t.description = raw.description
  if (isObj(raw.outputSchema)) t.outputSchema = raw.outputSchema
  if (isObj(raw.annotations)) t.annotations = raw.annotations
  if (Array.isArray(raw.icons)) { t.icons = raw.icons; if (raw.icons.some(i => isObj(i) && typeof i.src === 'string')) issues.push({ code: 'icon-url', level: 'warning', at: `${at}.icons` }) }
  if (isObj(raw._meta)) t._meta = raw._meta
  // Object.fromEntries defines own data properties, so an untrusted "__proto__" key stays inert data.
  const ext: Record<string, unknown> = Object.fromEntries([...Object.entries(isObj(raw.extensions) ? raw.extensions : {}), ...Object.entries(raw).filter(([k]) => !KNOWN.has(k))])
  if (Object.keys(ext).length) t.extensions = ext
  walkRefs(t.inputSchema, `${at}.inputSchema`, issues); if (t.outputSchema) walkRefs(t.outputSchema, `${at}.outputSchema`, issues)
  return t
}

function finish(tools: MCPToolDefinition[], issues: Issue[], lim: Limits) {
  if (tools.length > lim.maxTools) issues.push({ code: 'tools-limit', level: 'error' })
  const seen = new Set<string>()
  for (const t of tools) { if (seen.has(t.name)) issues.push({ code: 'duplicate-name', level: 'error', at: t.name }); seen.add(t.name) }
}

export function safeParse(text: string, lim: Limits = LIMITS): { value?: unknown; issues: Issue[] } {
  if (typeof text !== 'string' || !text.trim()) return { issues: [{ code: 'empty', level: 'error' }] }
  if (new TextEncoder().encode(text).length > lim.maxBytes) return { issues: [{ code: 'size', level: 'error' }] }
  if (jsonDepth(text, lim.maxDepth) > lim.maxDepth) return { issues: [{ code: 'depth', level: 'error' }] }
  try { return { value: JSON.parse(text.replace(/^\uFEFF/, '')), issues: [] } } catch { return { issues: [{ code: 'json', level: 'error' }] } }
}

const validCtx = (c: Partial<ImportContext> | undefined): c is ImportContext =>
  !!c && [c.profileId, c.authContextId, c.serverLabel, c.protocolVersion].every(x => typeof x === 'string' && x.trim() !== '') && TRANSPORTS.has(String(c.transport))

export function importCapture(text: string, ctx?: Partial<ImportContext>, lim: Limits = LIMITS, now = () => new Date().toISOString()): ImportResult {
  const { value, issues } = safeParse(text, lim)
  if (value === undefined) return { issues }
  try {
    if (isObj(value) && value.format === 'mcp-shield-inventory') return { ...importNative(value, issues, lim), kind: 'native' }
    const pages = Array.isArray(value) ? value : isObj(value) && Array.isArray(value.pages) ? value.pages : isObj(value) && ('result' in value || 'error' in value) ? [value] : undefined
    if (!pages) return { issues: [...issues, { code: 'shape', level: 'error' }] }
    if (!validCtx(ctx)) return { issues: [...issues, { code: 'missing-context', level: 'error' }] }
    const r = importPages(pages, ctx, issues, lim, now)
    return { ...r, kind: pages.length === 1 && !Array.isArray(value) ? 'jsonrpc' : 'pages' }
  } catch { return { issues: [...issues, { code: 'shape', level: 'error' }] } }
}

function importPages(pages: unknown[], ctx: ImportContext, issues: Issue[], lim: Limits, now: () => string): ImportResult {
  if (!pages.length) return { issues: [...issues, { code: 'shape', level: 'error' }] }
  if (pages.length > lim.maxPages) return { issues: [...issues, { code: 'pages-limit', level: 'error' }] }
  const tools: MCPToolDefinition[] = []
  const cursors = new Set<string>()
  let completeness: CaptureCompleteness = 'pagination-complete'
  let prevNext: string | undefined, ttlMs: number | undefined, cacheScope: 'public' | 'private' | undefined
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    const res = isObj(p) && isObj(p.response) ? p.response : p
    const reqCursor = isObj(p) && isObj(p.request) && isObj(p.request.params) && typeof p.request.params.cursor === 'string' ? p.request.params.cursor : undefined
    if (!isObj(res)) return { issues: [...issues, { code: 'shape', level: 'error', at: `pages[${i}]` }] }
    if ('error' in res && !('result' in res)) return { issues: [...issues, { code: 'rpc-error', level: 'error', at: `pages[${i}]` }] }
    const result = isObj(res.result) ? res.result : res
    if (!Array.isArray(result.tools)) return { issues: [...issues, { code: 'shape', level: 'error', at: `pages[${i}]` }] }
    if (i > 0 && reqCursor !== undefined && reqCursor !== prevNext) { issues.push({ code: 'cursor-gap', level: 'warning', at: `pages[${i}]` }); completeness = 'partial' }
    if (i > 0 && prevNext === undefined) { issues.push({ code: 'cursor-gap', level: 'warning', at: `pages[${i}]` }); completeness = 'partial' }
    if (typeof result.resultType === 'string' && result.resultType !== 'complete') { issues.push({ code: 'result-type', level: 'warning', at: `pages[${i}]` }); completeness = 'partial' }
    result.tools.forEach((t, j) => { const x = toTool(t, `pages[${i}].tools[${j}]`, issues); if (x) tools.push(x) })
    if (tools.length > lim.maxTools) break
    const next = typeof result.nextCursor === 'string' ? result.nextCursor : undefined
    if (next !== undefined) {
      if (cursors.has(next)) return { issues: [...issues, { code: 'circular-cursor', level: 'error', at: `pages[${i}].nextCursor` }] }
      cursors.add(next)
    }
    prevNext = next
    if (typeof result.ttlMs === 'number' && result.ttlMs >= 0) ttlMs = ttlMs === undefined ? result.ttlMs : Math.min(ttlMs, result.ttlMs)
    if (result.cacheScope === 'public' || result.cacheScope === 'private') cacheScope = cacheScope === 'private' ? 'private' : result.cacheScope
  }
  if (prevNext !== undefined) { issues.push({ code: 'partial', level: 'warning' }); completeness = 'partial' }
  if (!KNOWN_PROTOCOLS.includes(ctx.protocolVersion)) issues.push({ code: 'unknown-protocol', level: 'warning' })
  finish(tools, issues, lim)
  if (issues.some(x => x.level === 'error')) return { issues }
  return { issues, snapshot: {
    format: 'mcp-shield-inventory', schemaVersion: '1.0', snapshotId: uuid(), capturedAt: now(),
    target: { profileId: ctx.profileId, serverLabel: ctx.serverLabel, authContextId: ctx.authContextId, transport: ctx.transport, protocolVersion: ctx.protocolVersion },
    provenance: { source: ctx.source ?? 'manual-import' },
    capture: { completeness, pageCount: pages.length, toolCount: tools.length, ...(ttlMs !== undefined ? { ttlMs } : {}), ...(cacheScope ? { cacheScope } : {}) },
    tools,
  } }
}

function importNative(v: Record<string, unknown>, issues: Issue[], lim: Limits): ImportResult {
  if (v.schemaVersion !== '1.0') return { issues: [...issues, { code: 'format-version', level: 'error' }] }
  const target = v.target, cap = v.capture, prov = v.provenance
  if (!isObj(target) || !validCtx(target as Partial<ImportContext>) || !isObj(cap) || !Array.isArray(v.tools) || !isObj(prov)) return { issues: [...issues, { code: 'shape', level: 'error' }] }
  if (typeof cap.pageCount !== 'number' || cap.pageCount > lim.maxPages || cap.pageCount < 0) return { issues: [...issues, { code: cap.pageCount as number > lim.maxPages ? 'pages-limit' : 'shape', level: 'error' }] }
  if (v.tools.length > lim.maxTools) return { issues: [...issues, { code: 'tools-limit', level: 'error' }] }
  const tools = v.tools.map((t, i) => toTool(t, `tools[${i}]`, issues)).filter((t): t is MCPToolDefinition => !!t)
  finish(tools, issues, lim)
  let completeness = COMPLETENESS.has(String(cap.completeness)) ? cap.completeness as CaptureCompleteness : 'invalid'
  if (cap.toolCount !== tools.length) { issues.push({ code: 'count-mismatch', level: 'error' }); completeness = 'invalid' }
  if (completeness === 'partial') issues.push({ code: 'partial', level: 'warning' })
  const tg = target as unknown as SnapshotTarget
  if (!KNOWN_PROTOCOLS.includes(tg.protocolVersion)) issues.push({ code: 'unknown-protocol', level: 'warning' })
  if (issues.some(x => x.level === 'error')) return { issues }
  const source: CaptureSource = prov.source === 'local-collector' || prov.source === 'demo' ? prov.source : 'manual-import'
  return { issues, snapshot: {
    format: 'mcp-shield-inventory', schemaVersion: '1.0', snapshotId: typeof v.snapshotId === 'string' && v.snapshotId ? v.snapshotId : uuid(),
    capturedAt: typeof v.capturedAt === 'string' ? v.capturedAt : '',
    target: { profileId: tg.profileId, serverLabel: tg.serverLabel, authContextId: tg.authContextId, transport: tg.transport, protocolVersion: tg.protocolVersion },
    // A file can claim anything: a collector is never "verified" just because the file says so.
    provenance: { source, ...(typeof prov.collectorVersion === 'string' ? { collectorVersion: prov.collectorVersion } : {}), verifiedCollector: false },
    capture: { completeness, pageCount: cap.pageCount, toolCount: tools.length,
      ...(typeof cap.ttlMs === 'number' && cap.ttlMs >= 0 ? { ttlMs: cap.ttlMs } : {}), ...(cap.cacheScope === 'public' || cap.cacheScope === 'private' ? { cacheScope: cap.cacheScope } : {}) },
    tools,
  } }
}
