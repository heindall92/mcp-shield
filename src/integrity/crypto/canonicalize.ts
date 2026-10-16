/**
 * JSON Canonicalization Scheme (RFC 8785).
 * - Numbers: ECMAScript Number serialization (what JSON.stringify emits for finite numbers), -0 -> 0.
 * - Strings: JSON.stringify escaping (the RFC 8785 rules match ECMAScript), no Unicode normalisation.
 * - Objects: keys sorted by UTF-16 code units (JS default string comparison), recursively.
 * - Arrays keep their order. Whitespace is never emitted. Non-finite numbers and non-JSON values throw.
 */
export class CanonicalizationError extends Error { override name = 'CanonicalizationError' }

export function canonicalize(value: unknown, depth = 0): string {
  if (depth > 256) throw new CanonicalizationError('too deep')
  if (value === null) return 'null'
  switch (typeof value) {
    case 'boolean': return value ? 'true' : 'false'
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalizationError('non-finite number')
      return Object.is(value, -0) ? '0' : JSON.stringify(value)
    case 'string': return JSON.stringify(value)
    case 'object': {
      if (Array.isArray(value)) return '[' + value.map(v => canonicalize(v, depth + 1)).join(',') + ']'
      const o = value as Record<string, unknown>
      const keys = Object.keys(o).filter(k => o[k] !== undefined).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(o[k], depth + 1)).join(',') + '}'
    }
    default: throw new CanonicalizationError(`unsupported type ${typeof value}`)
  }
}

/** UTF-8 bytes of the canonical form (RFC 8785 §3.2.4). */
export const canonicalBytes = (value: unknown) => new TextEncoder().encode(canonicalize(value))
