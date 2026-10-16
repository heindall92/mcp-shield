import type { Finding } from '../types/mcp.types'

/** Known credential formats. Shared by the secret rules and the redactor. */
export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghs|ghu|ghr|github_pat)_[A-Za-z0-9_]{16,}/g },
  { name: 'AWS access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'OpenAI/Anthropic key', re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'Stripe key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'GitLab token', re: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  { name: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g },
]
export const SECRET_KEY = /(token|secret|password|passwd|pwd|api[_-]?key|apikey|private[_-]?key|credential|auth|bearer|session|cookie)/i

/** ${VAR}, ${env:VAR}, ${input:id} (VS Code), env:/op:/vault: references and empty strings are not secrets. */
export const isRef = (v: string) => /^\$\{[^}]+\}$/.test(v.trim()) || /^\$[A-Z_][A-Z0-9_]*$/.test(v.trim()) || /^(env:|op:\/\/|vault:|keychain:)/.test(v) || v.trim() === ''
/** Documentation placeholders such as "<YOUR_TOKEN>", "your-api-key", "xxxx", "changeme". */
export const isPlaceholder = (v: string) => /^<[^>]+>$/.test(v.trim()) || /^(your[_-]|YOUR_|REPLACE|CHANGE_?ME|changeme|xxx+|\*{3,}|\.\.\.|TODO)/i.test(v.trim())

export const findSecret = (v: string) => SECRET_PATTERNS.find(p => { p.re.lastIndex = 0; return p.re.test(v) })

const REDACTED = '[REDACTED]'
const keep = (m: string) => `${m.slice(0, Math.min(4, Math.floor(m.length / 4)))}…${REDACTED}`

/** Remove credentials from any free text before it is shown, exported or copied. Idempotent. */
export function redactString(s: string): string {
  if (!s) return s
  let out = s
  for (const p of SECRET_PATTERNS) out = out.replace(p.re, m => (m.includes(REDACTED) ? m : keep(m)))
  // scheme://user:password@host
  out = out.replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)([^\s@/]+)(@)/gi, (_, a, pw, c) => (pw === REDACTED ? `${a}${pw}${c}` : `${a}${REDACTED}${c}`))
  // ?token=…&api_key=…
  out = out.replace(/([?&](?:[a-z_]*?(?:token|key|secret|password|auth|sig)[a-z_]*)=)([^&\s"']+)/gi, (_, a, v) => (isRef(v) ? a + v : a + REDACTED))
  // Bearer / Basic credentials
  out = out.replace(/\b(Bearer|Basic|Token)\s+([A-Za-z0-9._~+/=-]{8,})/g, (_, a, v) => (v === REDACTED ? `${a} ${v}` : `${a} ${REDACTED}`))
  // KEY=value / "KEY": "value" with secret-looking keys
  out = out.replace(/\b([A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|APIKEY|PRIVATE_?KEY|CREDENTIAL)[A-Za-z0-9_]*)(\s*[=:]\s*"?)(\$\{[^}\s]*\}|[^\s",}]{4,})/gi, (all, k, sep, v) =>
    isRef(v) || v.startsWith(REDACTED) || v.includes('…') ? all : `${k}${sep}${REDACTED}`)
  return out
}

export const redactFinding = (f: Finding): Finding => ({ ...f, title: redactString(f.title), detail: redactString(f.detail), evidence: redactString(f.evidence), remediation: redactString(f.remediation) })

/** Deep-redact a config (for the "before" view and any copy of user input we render). */
export function redactValue<T>(v: T): T {
  if (typeof v === 'string') return redactString(v) as T
  if (Array.isArray(v)) return v.map(redactValue) as T
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) o[k] = typeof x === 'string' && SECRET_KEY.test(k) && !isRef(x) && !isPlaceholder(x) && x.length >= 4 ? REDACTED : redactValue(x)
    return o as T
  }
  return v
}
