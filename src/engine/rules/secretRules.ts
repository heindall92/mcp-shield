import type { Rule, Finding } from '../../types/mcp.types'
import { pick } from '../../i18n/lang'
import { mk } from './util'

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'GitHub token', re: /\b(ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{16,}/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'OpenAI/Anthropic key', re: /\bsk-(ant-)?[A-Za-z0-9_-]{16,}/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Stripe key', re: /\b(sk|rk)_live_[A-Za-z0-9]{16,}/ },
  { name: 'Postmark/UUID server token', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i },
  { name: 'URL credential', re: /[a-z]+:\/\/[^\s:/]+:[^\s@/]+@/i },
]
const SECRET_KEY = /(token|secret|password|passwd|api[_-]?key|private[_-]?key|credential)/i
const isRef = (v: string) => /^\$\{?[A-Z_]+\}?$/.test(v) || /^(env:|op:\/\/|vault:)/.test(v) || v === ''

export const hardcodedSecrets: Rule = {
  id: 'MCPS-SEC-001', category: 'secrets', name: { es: 'Secreto hardcodeado', en: 'Hardcoded secret' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    const mask = (v: string) => v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} chars)` : '****'
    for (const [k, v] of Object.entries(server.env ?? {})) {
      if (isRef(v)) continue
      const pat = PATTERNS.find(p => p.re.test(v))
      if (pat || (SECRET_KEY.test(k) && v.length >= 8)) out.push(mk({
        ruleId: 'MCPS-SEC-001', category: 'secrets', severity: pat ? 'critical' : 'high', server: serverName,
        title: L(`${pat?.name ?? 'Secreto'} en texto plano: env.${k}`, `${pat?.name ?? 'Secret'} in plain text: env.${k}`),
        detail: L('mcp.json suele acabar en dotfiles sincronizados, backups o repos. Además, cualquier servidor con acceso al FS puede leer este archivo.', 'mcp.json often ends up in synced dotfiles, backups or repos. Any server with filesystem access can also read it.'),
        evidence: `${k}=${mask(v)}`, location: `mcpServers.${serverName}.env.${k}`,
        remediation: L(`Sustituye por referencia: "${k}": "\${${k}}" e inyéctalo desde un secret manager / keychain. Rota la credencial expuesta.`, `Replace with a reference: "${k}": "\${${k}}" injected from a secret manager / keychain. Rotate the exposed credential.`),
        cwe: 'CWE-798',
      }))
    }
    ;(server.args ?? []).forEach((a, i) => {
      const pat = PATTERNS.find(p => p.re.test(a))
      if (pat) out.push(mk({
        ruleId: 'MCPS-SEC-002', category: 'secrets', severity: 'critical', server: serverName,
        title: L(`${pat.name} pasado como argumento CLI`, `${pat.name} passed as a CLI argument`),
        detail: L('Los argumentos son visibles en la lista de procesos (ps/Task Manager) para cualquier usuario local y quedan en logs.', 'Arguments are visible in the process list (ps/Task Manager) to any local user and end up in logs.'),
        evidence: mask(a), location: `mcpServers.${serverName}.args[${i}]`,
        remediation: L('Pásalo por variable de entorno referenciada, nunca por argv. Rota la credencial.', 'Pass it through a referenced environment variable, never argv. Rotate the credential.'), cwe: 'CWE-214',
      }))
    })
    return out
  },
}

export const secretRules: Rule[] = [hardcodedSecrets]
