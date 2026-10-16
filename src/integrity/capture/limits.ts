/** RFC-001 §5 resource limits. */
export const LIMITS = { maxBytes: 8 * 1024 * 1024, maxTools: 1000, maxPages: 128, maxDepth: 64, parseTimeoutMs: 15_000 } as const
export type Limits = { maxBytes: number; maxTools: number; maxPages: number; maxDepth: number }

export type IssueCode =
  | 'empty' | 'size' | 'depth' | 'json' | 'shape' | 'format-version' | 'rpc-error' | 'tools-limit' | 'pages-limit'
  | 'duplicate-name' | 'circular-cursor' | 'cursor-gap' | 'count-mismatch' | 'missing-context' | 'tool-shape'
  | 'external-ref' | 'icon-url' | 'partial' | 'result-type' | 'timeout' | 'unknown-protocol'
export interface Issue { code: IssueCode; level: 'error' | 'warning'; at?: string }

/** Nesting depth of a JSON text, computed without parsing (so a pathological document cannot blow the stack). */
export function jsonDepth(text: string, stopAt = Infinity): number {
  let depth = 0, max = 0, inStr = false, esc = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false; continue }
    if (c === 34) inStr = true
    else if (c === 123 || c === 91) { if (++depth > max) { max = depth; if (max > stopAt) return max } }
    else if (c === 125 || c === 93) depth--
  }
  return max
}
