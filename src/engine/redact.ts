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

export const REDACTED = '[REDACTED]'
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

/** Make invisible or terminal-control code points visible (tags, zero-width, bidi overrides, C0/C1 controls, ESC) so reports cannot smuggle text. */
// eslint-disable-next-line no-control-regex
export const safeText = (s: string) => s.replace(/[\u{E0000}-\u{E007F}\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu,
  ch => `⟨U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}⟩`)
const clean = (s: string) => safeText(redactString(s))
export const redactFinding = (f: Finding): Finding => ({ ...f, server: safeText(f.server), location: safeText(f.location), title: clean(f.title), detail: clean(f.detail), evidence: clean(f.evidence), remediation: clean(f.remediation) })


/* ── Contextual detection ────────────────────────────────────────────────────────────────
 * Pattern matching only catches credentials with a known format. In these positions any value
 * is treated as sensitive unless it is a known-safe literal: env values, `-e KEY=VAL`/`--env`,
 * header values, URL query values and the value after a --token/--key/--password-style flag. */

const WORDS = /^([A-Z]?[a-z]{1,15}|[A-Z]{1,16})([ ._/-]([A-Z]?[a-z]{1,15}|[A-Z]{1,16}))*$/
/** True for values that are clearly not credentials: booleans, small numbers, versions, paths, refs, placeholders, plain words. */
export function isSafeLiteral(raw: string): boolean {
  const v = raw.trim()
  if (v === '' || v.includes(REDACTED) || isRef(v) || isPlaceholder(v)) return true
  if (/\$\{[^}]+\}/.test(v)) { const rest = v.replace(/\$\{[^}]+\}/g, '').replace(/[\s:;,=/@.-]+/g, ' ').trim(); return rest === '' || isSafeLiteral(rest) }
  if (/^(true|false|null|yes|no|on|off|none|undefined)$/i.test(v)) return true
  if (/^-?\d{1,10}(\.\d+)?$/.test(v)) return true
  if (/^v?\d+(\.\d+){1,3}([-+.][0-9A-Za-z.]+)?$/.test(v)) return true // versions
  if (/^(\/|\.{1,2}[\\/]|~([\\/]|$)|[A-Za-z]:[\\/]|\\\\)/.test(v) && !/\s/.test(v)) return true // paths
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return !/:\/\/[^/\s]*@/.test(v) && [...v.matchAll(/[?&][^=&#]+=([^&#]*)/g)].every(m => isSafeLiteral(decode(m[1])))
  if (/^[a-z]+\/[a-z0-9.+-]+$/i.test(v)) return true // mime types
  if (/^@[a-z0-9._-]+\/[a-z0-9._-]+(@[\w.^~-]+)?$/.test(v) || /^[a-z][a-z0-9._-]*(@|==)\d[\w.-]*$/.test(v)) return true // package specs
  if (/^(Bearer|Basic|Token)$/i.test(v)) return true
  return v.length <= 48 && WORDS.test(v)
}
const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

const SENSITIVE_SEGMENTS = new Set(['token', 'tokens', 'key', 'keys', 'apikey', 'secret', 'secrets', 'password', 'passwd', 'pwd', 'pass', 'passphrase', 'pat', 'auth', 'authorization', 'credential', 'credentials', 'cookie', 'session', 'bearer', 'sig', 'signature', 'jwt', 'otp', 'pin', 'dsn'])
/** `--api-token`, `--clientSecret`, `-p`… : does this flag (or key) name a credential? Segment-based, so `--path` or `--keyboard` do not match. */
export function isSensitiveName(name: string): boolean {
  const segs = name.replace(/^-+/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return segs.some(s => SENSITIVE_SEGMENTS.has(s)) || /api_?key|access_?key|private_?key/i.test(name)
}
export const isFlag = (a: string) => /^--?[A-Za-z][\w.-]*$/.test(a)

/** URL with credentials in userinfo or unknown query values masked. */
export function redactUrl(u: string): string {
  const out = u.replace(/(:\/\/[^\s/@:]+:)([^\s@/]+)(@)/, (_, a, pw, c) => `${a}${pw === REDACTED ? pw : REDACTED}${c}`)
    .replace(/([?&][^=&#\s]+=)([^&#\s]*)/g, (all, k, v) => (isSafeLiteral(decode(v)) ? all : k + REDACTED))
  return redactString(out)
}

/** Context-aware redaction of an argv. */
export function redactArgs(args: string[]): string[] {
  return args.map((a, i) => {
    const prev = args[i - 1] ?? ''
    if (/^(-e|--env)$/.test(prev) || /^--env=/.test(a)) {
      const body = a.replace(/^--env=/, ''); const eq = body.indexOf('=')
      if (eq > 0 && !isSafeLiteral(body.slice(eq + 1))) return `${a.startsWith('--env=') ? '--env=' : ''}${body.slice(0, eq)}=${REDACTED}`
      return a
    }
    const inline = /^(--?[A-Za-z][\w.-]*)=(.*)$/s.exec(a)
    if (inline && isSensitiveName(inline[1]) && !isSafeLiteral(inline[2])) return `${inline[1]}=${REDACTED}`
    if (isFlag(prev) && isSensitiveName(prev) && !a.startsWith('-') && !isSafeLiteral(a)) return REDACTED
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(a)) return redactUrl(a)
    return redactString(a)
  })
}
const redactBag = (bag: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(bag).map(([k, x]) => [k, typeof x === 'string' ? (isSafeLiteral(x) ? redactString(x) : REDACTED) : redactValue(x)]))

/** Deep-redact a config (for the "before" view and any copy of user input we render). */
export function redactValue<T>(v: T): T {
  if (typeof v === 'string') return redactString(v) as T
  if (Array.isArray(v)) return v.map(redactValue) as T
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) o[k] =
      (k === 'env' || k === 'headers') && x && typeof x === 'object' && !Array.isArray(x) ? redactBag(x as Record<string, unknown>)
      : k === 'args' && Array.isArray(x) ? redactArgs(x.map(String))
      : (k === 'url' || k === 'serverUrl') && typeof x === 'string' ? redactUrl(x)
      : typeof x === 'string' && SECRET_KEY.test(k) && !isRef(x) && !isPlaceholder(x) && x.length >= 4 ? REDACTED : redactValue(x)
    return o as T
  }
  return v
}
