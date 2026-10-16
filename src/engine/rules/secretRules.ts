import type { Rule, Finding } from '../../types/mcp.types'
import { pick } from '../../i18n/lang'
import { mk } from './util'
import { SECRET_KEY, isRef, isPlaceholder, findSecret } from '../redact'

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
const URL_CRED = /[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i
const URL_QUERY_SECRET = /[?&][a-z_]*?(token|key|secret|password|auth|sig)[a-z_]*=(?!\$\{)[^&\s]{6,}/i
const BEARER = /\b(Bearer|Basic|Token)\s+(?!\$\{)[A-Za-z0-9._~+/=-]{12,}/
const mask = (v: string) => (v.length > 12 ? `${v.slice(0, 3)}…(${v.length} chars)` : '****')
/** Values that are clearly not credentials even under a secret-looking key. */
const benign = (v: string) => /^(true|false|\d{1,6}|https?:\/\/[^@?]*|[./~][\w./-]*|[A-Z]:\\[\w\\. -]*)$/i.test(v.trim())

export const hardcodedSecrets: Rule = {
  id: 'MCPS-SEC-001', category: 'secrets', name: { es: 'Secreto hardcodeado', en: 'Hardcoded secret' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    const scan = (bag: Record<string, string> | undefined, kind: 'env' | 'headers') => {
      for (const [k, v] of Object.entries(bag ?? {})) {
        if (typeof v !== 'string' || isRef(v) || isPlaceholder(v)) continue
        const pat = findSecret(v)
        const bearer = BEARER.test(v)
        const uuid = SECRET_KEY.test(k) && UUID.test(v)
        const named = SECRET_KEY.test(k) && v.trim().length >= 8 && !benign(v) && !/\$\{[^}]+\}/.test(v)
        if (!(pat || bearer || uuid || named)) continue
        out.push(mk({
          ruleId: 'MCPS-SEC-001', category: 'secrets', severity: pat || bearer || uuid ? 'critical' : 'high', server: serverName,
          title: L(`${pat?.name ?? (bearer ? 'Token Authorization' : 'Secreto')} en texto plano: ${kind}.${k}`, `${pat?.name ?? (bearer ? 'Authorization token' : 'Secret')} in plain text: ${kind}.${k}`),
          detail: L('mcp.json suele acabar en dotfiles sincronizados, backups o repos. Además, cualquier servidor con acceso al FS puede leer este archivo.', 'mcp.json often ends up in synced dotfiles, backups or repos. Any server with filesystem access can also read it.'),
          evidence: `${k}=${mask(v)}`, location: `mcpServers.${serverName}.${kind}.${k}`,
          remediation: kind === 'env'
            ? L(`Sustituye por referencia: "${k}": "\${${k}}" e inyéctalo desde un secret manager / keychain. Rota la credencial expuesta.`, `Replace with a reference: "${k}": "\${${k}}" injected from a secret manager / keychain. Rotate the exposed credential.`)
            : L(`Usa "${k}": "Bearer \${env:MCP_TOKEN}" (o \${input:…} en VS Code). Rota la credencial expuesta.`, `Use "${k}": "Bearer \${env:MCP_TOKEN}" (or \${input:…} in VS Code). Rotate the exposed credential.`),
          cwe: 'CWE-798',
        }))
      }
    }
    scan(server.env, 'env'); scan(server.headers, 'headers')
    if (server.url && (URL_CRED.test(server.url) || URL_QUERY_SECRET.test(server.url) || findSecret(server.url))) out.push(mk({
      ruleId: 'MCPS-SEC-001', category: 'secrets', severity: 'critical', server: serverName,
      title: L('Credencial incrustada en la URL del servidor remoto', 'Credential embedded in the remote server URL'),
      detail: L('Las URLs acaban en logs de proxy, historial y cabeceras Referer.', 'URLs end up in proxy logs, history and Referer headers.'),
      evidence: server.url, location: `mcpServers.${serverName}.url`,
      remediation: L('Quita el token de la URL y envíalo en headers con una referencia ${env:…}. Rota la credencial.', 'Remove the token from the URL and send it in headers with an ${env:…} reference. Rotate the credential.'), cwe: 'CWE-598',
    }))
    return out
  },
}

export const argvSecrets: Rule = {
  id: 'MCPS-SEC-002', category: 'secrets', name: { es: 'Secreto en argumentos CLI', en: 'Secret in CLI arguments' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    const args = server.args ?? []
    args.forEach((a, i) => {
      if (isRef(a) || isPlaceholder(a)) return
      const pat = findSecret(a)
      const urlCred = URL_CRED.test(a)
      const flagVal = i > 0 && /^--?[\w-]*(token|key|secret|password)[\w-]*$/i.test(args[i - 1]) && a.length >= 8 && !isRef(a) && !benign(a)
      const inline = /^--?[\w-]*(token|key|secret|password)[\w-]*=(?!\$\{)(.{8,})$/i.exec(a)
      if (!(pat || urlCred || flagVal || inline)) return
      out.push(mk({
        ruleId: 'MCPS-SEC-002', category: 'secrets', severity: 'critical', server: serverName,
        title: L(`${pat?.name ?? (urlCred ? 'Credencial en URL' : 'Secreto')} pasado como argumento CLI`, `${pat?.name ?? (urlCred ? 'URL credential' : 'Secret')} passed as a CLI argument`),
        detail: L('Los argumentos son visibles en la lista de procesos (ps/Task Manager) para cualquier usuario local y quedan en logs.', 'Arguments are visible in the process list (ps/Task Manager) to any local user and end up in logs.'),
        evidence: mask(a), location: `mcpServers.${serverName}.args[${i}]`,
        remediation: L('Pásalo por variable de entorno referenciada, nunca por argv. Rota la credencial.', 'Pass it through a referenced environment variable, never argv. Rotate the credential.'), cwe: 'CWE-214',
      }))
    })
    return out
  },
}

export const secretRules: Rule[] = [hardcodedSecrets, argvSecrets]
