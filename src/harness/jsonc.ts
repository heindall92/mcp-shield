/**
 * Offset of the first syntax error in a JSON/JSONC document (comments and trailing commas allowed), or -1.
 * Browsers' JSON.parse messages do not reliably include a position, and a finding must point at a line.
 * Iterative (explicit stack): no recursion limit, linear time.
 */
export function jsoncErrorAt(s: string): number {
  const n = s.length
  let i = 0
  const ws = () => {
    for (;;) {
      while (i < n && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r' || s[i] === '\uFEFF')) i++
      if (s[i] === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue }
      if (s[i] === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue }
      return
    }
  }
  const str = () => { i++; while (i < n) { const c = s[i]; if (c === '\\') { i += 2; continue } if (c === '"') { i++; return true } if (c === '\n') return false; i++ } return false }
  const LIT = /^(?:true|false|null|-?(?:0|[1-9]\d{0,400})(?:\.\d{1,400})?(?:[eE][+-]?\d{1,10})?)/
  const lit = () => { const m = LIT.exec(s.slice(i, i + 900)); if (!m) return false; i += m[0].length; return true }
  const key = () => { ws(); if (s[i] !== '"' || !str()) return false; ws(); if (s[i] !== ':') return false; i++; return true }
  const stack: ('o' | 'a')[] = []
  value: for (;;) {
    ws()
    if (s[i] === '{') { i++; ws(); if (s[i] === '}') i++; else { stack.push('o'); if (!key()) return i; continue value } }
    else if (s[i] === '[') { i++; ws(); if (s[i] === ']') i++; else { stack.push('a'); continue value } }
    else if (s[i] === '"') { if (!str()) return Math.min(i, n) }
    else if (!lit()) return i
    for (;;) {
      ws()
      if (!stack.length) return i < n ? i : -1
      const top = stack[stack.length - 1]
      if (s[i] === ',') {
        i++; ws()
        if ((top === 'o' && s[i] === '}') || (top === 'a' && s[i] === ']')) { i++; stack.pop(); continue }
        if (top === 'o' && !key()) return i
        continue value
      }
      if ((top === 'o' && s[i] === '}') || (top === 'a' && s[i] === ']')) { i++; stack.pop(); continue }
      return i
    }
  }
}
