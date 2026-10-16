import type { Rule, Finding } from '../../types/mcp.types'
import { mk } from './util'

/** Detects remote package execution without a pinned version (rug-pull class, e.g. postmark-mcp). */
const PINNED = /^(@[^/]+\/)?[^@]+@\d+\.\d+\.\d+(-[\w.]+)?$/
const KNOWN_PUBLISHERS = ['@modelcontextprotocol/', '@anthropic-ai/', '@cloudflare/', '@github/']

function pkgFromArgs(args: string[]): { pkg: string; idx: number } | null {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('-')) continue
    return { pkg: a, idx: i }
  }
  return null
}

export const unpinnedNpx: Rule = {
  id: 'MCPS-SC-001', category: 'supply-chain', name: 'Paquete remoto sin versión fijada',
  check: ({ serverName, server }) => {
    const out: Finding[] = []
    const cmd = (server.command ?? '').split(/[\\/]/).pop() ?? ''
    if (!['npx', 'bunx', 'uvx', 'pnpx'].includes(cmd)) return out
    const args = server.args ?? []
    const p = pkgFromArgs(args)
    if (!p) return out
    const autoYes = args.includes('-y') || args.includes('--yes')
    const pinned = cmd === 'uvx' ? /==\d/.test(p.pkg) : PINNED.test(p.pkg)
    if (!pinned) out.push(mk({
      ruleId: 'MCPS-SC-001', category: 'supply-chain', severity: autoYes ? 'high' : 'medium', server: serverName,
      title: `${cmd}${autoYes ? ' -y' : ''} ejecuta "${p.pkg}" sin versión anclada`,
      detail: 'Cada arranque descarga la última versión publicada. Un mantenedor comprometido (o malicioso) puede introducir un backdoor en una versión posterior sin que nadie lo revise — patrón rug-pull documentado en postmark-mcp 1.0.16.',
      evidence: [server.command, ...args].join(' '), location: `mcpServers.${serverName}.args[${p.idx}]`,
      remediation: `Fija la versión exacta (p.ej. ${p.pkg.replace(/@latest$/, '')}@1.2.3), quita -y y verifica integridad (lockfile / npm audit signatures).`,
      cwe: 'CWE-494',
    }))
    if (!KNOWN_PUBLISHERS.some(k => p.pkg.startsWith(k)) && !p.pkg.startsWith('@')) out.push(mk({
      ruleId: 'MCPS-SC-002', category: 'supply-chain', severity: 'low', server: serverName,
      title: `Paquete sin scope de publisher verificado: "${p.pkg.split('@')[0]}"`,
      detail: 'Los paquetes sin scope son más fáciles de suplantar (typosquatting / impersonation de marca).',
      evidence: p.pkg, location: `mcpServers.${serverName}.args[${p.idx}]`,
      remediation: 'Usa el servidor oficial del proveedor o revisa el repositorio fuente, publisher y provenance antes de instalar.',
      cwe: 'CWE-829',
    }))
    return out
  },
}

export const insecureRemote: Rule = {
  id: 'MCPS-SC-003', category: 'supply-chain', name: 'Servidor MCP remoto sin TLS',
  check: ({ serverName, server }) => {
    if (!server.url || !/^http:\/\//i.test(server.url) || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(server.url)) return []
    return [mk({
      ruleId: 'MCPS-SC-003', category: 'supply-chain', severity: 'high', server: serverName,
      title: 'Transporte remoto en HTTP plano', evidence: server.url, location: `mcpServers.${serverName}.url`,
      detail: 'Un atacante en la red puede leer tokens y alterar tools/list (inyectar descripciones envenenadas) en tránsito.',
      remediation: 'Usa https:// con OAuth 2.1 y valida el certificado; nunca envíes tokens por HTTP.', cwe: 'CWE-319',
    })]
  },
}

export const supplyChainRules: Rule[] = [unpinnedNpx, insecureRemote]
