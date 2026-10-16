import type { MCPShieldSnapshot, MCPToolDefinition } from '../domain/types'
import { canonicalBytes } from './canonicalize'
import { redactString, REDACTED } from '../../engine/redact'

/**
 * Integrity Hash Engine (RFC-001 §6.1).
 * - Public SHA-256 of a redacted, shareable projection (versioned, field list explicit).
 * - Private HMAC-SHA-256 of the full canonical definition bound to profile + auth context.
 * - Root HMAC over the ordered per-tool HMACs + binding metadata.
 * The HMAC key lives only in memory; it is exported only inside the encrypted baseline package.
 */
export const PUBLIC_PROJECTION = 'mcps-public/1:name,title,description,inputSchema,outputSchema,annotations'
export const TOOL_HMAC = 'mcps-hmac/1'
export const ROOT_HMAC = 'mcps-root/1'

const subtle = () => { const s = globalThis.crypto?.subtle; if (!s) throw new Error('WebCrypto unavailable'); return s }
export const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
/** Exact-name ordering by UTF-16 code units (same as RFC 8785 key order). */
export const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
const SECRETISH_KEY = /(token|secret|password|passwd|api[_-]?key|apikey|credential|authorization|cookie|session)/i

function scrub(v: unknown, depth = 0): unknown {
  if (depth > 64) return null
  if (typeof v === 'string') return redactString(v)
  if (Array.isArray(v)) return v.map(x => scrub(x, depth + 1))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' && SECRETISH_KEY.test(k) && x.length >= 8 && !/^\$\{/.test(x) && !/^(string|number|boolean|object|array|integer)$/.test(x) ? REDACTED : scrub(x, depth + 1)]))
  return v
}

/** What a public hash covers: no _meta, extensions or icons (they can carry secrets or URLs); strings redacted. */
export function publicProjection(t: MCPToolDefinition) {
  return { v: PUBLIC_PROJECTION, schemaVersion: '1.0', tool: scrub({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, outputSchema: t.outputSchema, annotations: t.annotations }) }
}
export async function sha256Hex(value: unknown) { return hex(await subtle().digest('SHA-256', canonicalBytes(value))) }

export interface HmacKey { raw: Uint8Array; key: CryptoKey }
export async function importHmacKey(raw: Uint8Array): Promise<HmacKey> {
  if (raw.length < 32) throw new Error('HMAC key must be at least 256 bits')
  const key = await subtle().importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return { raw, key }
}
export async function generateHmacKey(): Promise<HmacKey> { return importHmacKey(globalThis.crypto.getRandomValues(new Uint8Array(32))) }
const mac = async (k: HmacKey, value: unknown) => hex(await subtle().sign('HMAC', k.key, canonicalBytes(value)))

export interface ToolPrint { name: string; publicSha256: string; hmac: string }
export interface Fingerprint { publicRoot: string; root: string; tools: ToolPrint[]; params: { projection: string; toolHmac: string; rootHmac: string } }

export async function fingerprint(s: MCPShieldSnapshot, k: HmacKey): Promise<Fingerprint> {
  const sorted = [...s.tools].sort(byName)
  const tools = await Promise.all(sorted.map(async t => ({
    name: t.name,
    publicSha256: await sha256Hex(publicProjection(t)),
    hmac: await mac(k, { v: TOOL_HMAC, profileId: s.target.profileId, authContextId: s.target.authContextId, tool: t }),
  })))
  const root = await mac(k, { v: ROOT_HMAC, profileId: s.target.profileId, authContextId: s.target.authContextId, transport: s.target.transport,
    protocolVersion: s.target.protocolVersion, completeness: s.capture.completeness, tools: tools.map(t => [t.name, t.hmac]) })
  const publicRoot = await sha256Hex({ v: PUBLIC_PROJECTION, tools: tools.map(t => [t.name, t.publicSha256]) })
  return { publicRoot, root, tools, params: { projection: PUBLIC_PROJECTION, toolHmac: TOOL_HMAC, rootHmac: ROOT_HMAC } }
}
