/**
 * Structural JSON Schema diff for tool inputs (RFC-001 §7). Local only: `$ref` is compared as text and
 * never resolved. Declared schema is not the server's effective permission model.
 */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const props = (s: unknown) => (isObj(s) && isObj(s.properties) ? s.properties : {}) as Record<string, unknown>
const req = (s: unknown) => new Set(isObj(s) && Array.isArray(s.required) ? s.required.filter((x): x is string => typeof x === 'string') : [])
const RELAXING = ['maxLength', 'maxItems', 'maximum', 'exclusiveMaximum', 'pattern', 'format', 'const', 'maxProperties', 'propertyNames']

export interface SchemaDelta {
  /** Surface expansion: more inputs accepted than before. */
  expanded: string[]
  /** Other structural changes, with compatibility notes. */
  changed: string[]
  breaking: string[]
  /** Paths whose `x-mcp-header` annotation was added, removed or changed (MCP 2026-07-28 Tool.inputSchema). */
  headers: string[]
}

export function schemaDiff(a: unknown, b: unknown, path = 'inputSchema', out: SchemaDelta = { expanded: [], changed: [], breaking: [], headers: [] }, depth = 0): SchemaDelta {
  if (depth > 32) return out
  if (!isObj(a) || !isObj(b)) { if (JSON.stringify(a) !== JSON.stringify(b)) out.changed.push(path); return out }
  if (JSON.stringify(a['x-mcp-header']) !== JSON.stringify(b['x-mcp-header'])) out.headers.push(path)
  if (JSON.stringify(a.type) !== JSON.stringify(b.type)) {
    const ta = new Set([a.type].flat()), tb = new Set([b.type].flat())
    if ([...tb].some(t => !ta.has(t))) out.expanded.push(`${path}.type`); else out.changed.push(`${path}.type`)
  }
  if (Array.isArray(a.enum) && (!Array.isArray(b.enum) || b.enum.some(x => !(a.enum as unknown[]).some(y => JSON.stringify(y) === JSON.stringify(x))))) out.expanded.push(`${path}.enum`)
  else if (!Array.isArray(a.enum) && Array.isArray(b.enum)) out.breaking.push(`${path}.enum`)
  for (const k of RELAXING) if (k in a && !(k in b)) out.expanded.push(`${path}.${k}`)
    else if (k in a && k in b && JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.changed.push(`${path}.${k}`)
    else if (!(k in a) && k in b) out.breaking.push(`${path}.${k}`)
  const apA = a.additionalProperties, apB = b.additionalProperties
  if (apA === false && apB !== false) out.expanded.push(`${path}.additionalProperties`)
  else if (apA !== false && apB === false) out.breaking.push(`${path}.additionalProperties`)
  for (const k of ['$ref', 'oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else', '$defs', 'items', 'patternProperties', 'dependentSchemas'])
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      if (k === 'items' && isObj(a[k]) && isObj(b[k])) schemaDiff(a[k], b[k], `${path}.items`, out, depth + 1)
      else (k === 'anyOf' || k === 'oneOf' || k === 'patternProperties' ? out.expanded : out.changed).push(`${path}.${k}`)
    }
  const pa = props(a), pb = props(b), ra = req(a), rb = req(b)
  for (const k of Object.keys(pb)) {
    const at = `${path}.properties.${k}`
    if (!(k in pa)) { out.expanded.push(at); if (rb.has(k)) out.breaking.push(`${at} (required)`); if (isObj(pb[k]) && 'x-mcp-header' in pb[k]) out.headers.push(at) }
    else schemaDiff(pa[k], pb[k], at, out, depth + 1)
  }
  for (const k of Object.keys(pa)) if (!(k in pb)) { out.breaking.push(`${path}.properties.${k} (removed)`); if (isObj(pa[k]) && 'x-mcp-header' in pa[k]) out.headers.push(`${path}.properties.${k}`) }
  for (const k of rb) if (!ra.has(k) && k in pa) out.breaking.push(`${path}.required.${k}`)
  for (const k of ra) if (!rb.has(k)) out.changed.push(`${path}.required.${k} (now optional)`)
  for (const k of ['description', 'title', 'default', 'examples', 'minimum', 'minLength', 'minItems'])
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.changed.push(`${path}.${k}`)
  return out
}
