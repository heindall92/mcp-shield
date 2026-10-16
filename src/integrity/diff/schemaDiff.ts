/**
 * Conservative semantic compatibility for tool input schemas (RFC-001 §7).
 * Each change is EXPANDED (accepts more inputs), RESTRICTED (accepts fewer) or UNKNOWN (not provable
 * without a full JSON Schema solver). `$ref` is compared as text and never resolved. A declared schema
 * is not the server's effective permission model.
 */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const J = (v: unknown) => JSON.stringify(v)
const props = (s: Record<string, unknown>) => (isObj(s.properties) ? s.properties : {}) as Record<string, unknown>
const req = (s: Record<string, unknown>) => new Set(Array.isArray(s.required) ? s.required.filter((x): x is string => typeof x === 'string') : [])

export interface SchemaDelta { expanded: string[]; restricted: string[]; unknown: string[]; headers: string[] }

/** Upper bounds: larger accepts more. Lower bounds: smaller accepts more. */
const UPPER = ['maxLength', 'maxItems', 'maxProperties', 'maximum', 'exclusiveMaximum', 'maxContains']
const LOWER = ['minLength', 'minItems', 'minProperties', 'minimum', 'exclusiveMinimum', 'minContains']
/** Keywords whose change can't be ordered conservatively: any change is UNKNOWN, removal is EXPANDED, addition RESTRICTED. */
const OPAQUE = ['pattern', 'format', 'const', 'multipleOf', 'propertyNames', 'contains', 'uniqueItems', 'not', 'if', 'then', 'else', 'dependentRequired', 'dependentSchemas', 'patternProperties', 'prefixItems', 'unevaluatedProperties', 'unevaluatedItems', '$ref', '$defs', 'allOf']
const NOTE = ['description', 'title', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly', '$comment', 'x-mcp-header']

function setDiff(a: unknown[], b: unknown[]) {
  const A = new Set(a.map(J)), B = new Set(b.map(J))
  return { added: [...B].filter(x => !A.has(x)).length, removed: [...A].filter(x => !B.has(x)).length }
}

export function schemaDiff(a: unknown, b: unknown, path = 'inputSchema', out: SchemaDelta = { expanded: [], restricted: [], unknown: [], headers: [] }, depth = 0): SchemaDelta {
  if (J(a) === J(b)) return out
  if (depth > 32) { out.unknown.push(path); return out }
  // boolean schemas: true accepts all, false none
  if (typeof a === 'boolean' || typeof b === 'boolean' || !isObj(a) || !isObj(b)) {
    if (a === false || b === true) out.expanded.push(path); else if (a === true || b === false) out.restricted.push(path); else out.unknown.push(path)
    return out
  }
  if (J(a['x-mcp-header']) !== J(b['x-mcp-header'])) out.headers.push(path)
  if (J(a.type) !== J(b.type)) {
    if (a.type === undefined) out.restricted.push(`${path}.type`)
    else if (b.type === undefined) out.expanded.push(`${path}.type`)
    else { const d = setDiff([a.type].flat(), [b.type].flat()); (d.added && d.removed ? out.unknown : d.added ? out.expanded : out.restricted).push(`${path}.type`) }
  }
  if (J(a.enum) !== J(b.enum)) {
    if (!Array.isArray(a.enum)) out.restricted.push(`${path}.enum`)
    else if (!Array.isArray(b.enum)) out.expanded.push(`${path}.enum`)
    else { const d = setDiff(a.enum, b.enum); (d.added && d.removed ? out.unknown : d.added ? out.expanded : out.restricted).push(`${path}.enum`) }
  }
  for (const k of ['anyOf', 'oneOf'] as const) if (J(a[k]) !== J(b[k])) {
    const at = `${path}.${k}`
    if (!Array.isArray(a[k])) out.restricted.push(at)
    else if (!Array.isArray(b[k])) out.expanded.push(at)
    else {
      const d = setDiff(a[k] as unknown[], b[k] as unknown[])
      // oneOf is exclusive: adding an option can also reject inputs that now match two branches.
      if (d.added && d.removed) out.unknown.push(at)
      else if (d.removed) out.restricted.push(at)
      else (k === 'anyOf' ? out.expanded : out.unknown).push(at)
    }
  }
  for (const [keys, up] of [[UPPER, true], [LOWER, false]] as const) for (const k of keys) {
    const x = a[k], y = b[k]
    if (J(x) === J(y)) continue
    const at = `${path}.${k}`
    if (x === undefined) out.restricted.push(at)
    else if (y === undefined) out.expanded.push(at)
    else if (typeof x === 'number' && typeof y === 'number') ((y > x) === up ? out.expanded : out.restricted).push(at)
    else out.unknown.push(at)
  }
  for (const k of OPAQUE) if (J(a[k]) !== J(b[k])) (a[k] === undefined ? out.restricted : b[k] === undefined ? out.expanded : out.unknown).push(`${path}.${k}`)
  const apA = a.additionalProperties, apB = b.additionalProperties
  if (J(apA) !== J(apB)) {
    const at = `${path}.additionalProperties`
    if (apA === false || apB === undefined || apB === true) out.expanded.push(at)
    else if (apB === false || apA === undefined || apA === true) out.restricted.push(at)
    else out.unknown.push(at)
  }
  if (J(a.items) !== J(b.items)) schemaDiff(a.items ?? true, b.items ?? true, `${path}.items`, out, depth + 1)
  const pa = props(a), pb = props(b), ra = req(a), rb = req(b)
  for (const k of Object.keys(pb)) {
    const at = `${path}.properties.${k}`
    if (!(k in pa)) {
      // A new declared property is new surface even when additionalProperties already allowed it.
      out.expanded.push(at); if (rb.has(k)) out.restricted.push(`${path}.required.${k}`)
      if (isObj(pb[k]) && 'x-mcp-header' in (pb[k] as object)) out.headers.push(at)
    } else schemaDiff(pa[k], pb[k], at, out, depth + 1)
  }
  for (const k of Object.keys(pa)) if (!(k in pb)) {
    out.restricted.push(`${path}.properties.${k} (removed)`)
    if (isObj(pa[k]) && 'x-mcp-header' in (pa[k] as object)) out.headers.push(`${path}.properties.${k}`)
  }
  for (const k of rb) if (!ra.has(k) && k in pa) out.restricted.push(`${path}.required.${k}`)
  for (const k of ra) if (!rb.has(k)) out.expanded.push(`${path}.required.${k} (now optional)`)
  void NOTE
  return out
}
