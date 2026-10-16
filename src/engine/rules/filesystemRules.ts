import type { Rule, Finding, Severity } from '../../types/mcp.types'
import { pick } from '../../i18n/lang'
import { mk, launcher } from './util'

const DANGEROUS: { re: RegExp; es: string; en: string; sev: Severity }[] = [
  { re: /^\/$/, es: 'raíz del sistema (/)', en: 'system root (/)', sev: 'critical' },
  { re: /^[A-Za-z]:\\?$/, es: 'unidad completa (C:\\)', en: 'whole drive (C:\\)', sev: 'critical' },
  { re: /(^|[\\/])\.ssh([\\/]|$)/, es: 'claves SSH (~/.ssh)', en: 'SSH keys (~/.ssh)', sev: 'critical' },
  { re: /(^|[\\/])\.(aws|gnupg|kube|docker)([\\/]|$)/, es: 'credenciales cloud/GPG/kube', en: 'cloud/GPG/kube credentials', sev: 'critical' },
  { re: /^(~|\$HOME|\/home\/[^/]+|\/Users\/[^/]+|C:\\Users\\[^\\]+)[\\/]?$/i, es: 'home completo del usuario', en: "user's entire home", sev: 'high' },
  { re: /^\/(etc|root|boot|proc|sys|var\/run|run)([\\/]|$)/, es: 'directorio de sistema', en: 'system directory', sev: 'high' },
]

/** True when an explicit mcp-server-git version (==, @ or docker tag) is >= 2025.12.18 (numeric compare). */
export function gitPatched(s: string): boolean {
  const m = /mcp-server-git(?:==|@|:)v?(\d+)\.(\d+)\.(\d+)/.exec(s)
  if (!m) return false
  const [y, mo, d] = m.slice(1).map(Number)
  return y * 10000 + mo * 100 + d >= 20251218
}

export const excessiveMounts: Rule = {
  id: 'MCPS-FS-001', category: 'filesystem', name: { es: 'Exposición excesiva del sistema de ficheros', en: 'Excessive filesystem exposure' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    const { args, offset } = launcher(server)
    args.forEach((raw, i) => {
      const prev = args[i - 1] ?? ''
      let paths: string[]
      if (/^(-v|--volume)$/.test(prev) || /^(-v|--volume)=/.test(raw)) paths = [raw.replace(/^(-v|--volume)=/, '').split(':')[0]]
      else if (prev === '--mount' || raw.startsWith('--mount=')) paths = [...raw.matchAll(/(?:^|,)(?:src|source)=([^,]+)/g)].map(m => m[1])
      else paths = [raw.replace(/^--?[\w-]+=/, '')]
      const hit = paths.map(p => DANGEROUS.find(d => d.re.test(p.trim()))).find(Boolean)
      if (hit) out.push(mk({
        ruleId: 'MCPS-FS-001', category: 'filesystem', severity: hit.sev, server: serverName,
        title: L(`Acceso a ${hit.es}`, `Access to ${hit.en}`),
        detail: L('Un servidor MCP con este alcance permite que una inyección de prompt o una vulnerabilidad de argument injection (clase CVE-2025-68144, CWE-88) lea o sobrescriba ficheros sensibles fuera del proyecto.',
          'An MCP server with this scope lets a prompt injection or an argument-injection bug (CVE-2025-68144 class, CWE-88) read or overwrite sensitive files outside the project.'),
        evidence: raw, location: `mcpServers.${serverName}.args[${i + offset}]`,
        remediation: L('Limita el servidor al directorio del proyecto (./workspace) y ejecútalo en contenedor con montaje read-only.', 'Restrict the server to the project directory (./workspace) and run it in a container with a read-only mount.'),
        cwe: 'CWE-22',
      }))
    })
    const gitArg = args.find(a => /(^|\/)mcp-server-git([=@:]|$)/.test(a))
    if (gitArg) {
      const pinnedSafe = gitPatched(args.join(' '))
      if (!pinnedSafe) out.push(mk({
        ruleId: 'MCPS-FS-002', category: 'filesystem', severity: 'high', server: serverName,
        title: L('mcp-server-git sin versión parcheada ≥ 2025.12.18 (CVE-2025-68144)', 'mcp-server-git without patched version ≥ 2025.12.18 (CVE-2025-68144)'),
        detail: L('Versiones anteriores pasaban argumentos de git_diff/git_checkout sin sanear: valores tipo "--output=<ruta>" permitían sobrescribir ficheros locales (CWE-88).',
          'Earlier versions passed git_diff/git_checkout arguments unsanitised: values like "--output=<path>" allowed overwriting local files (CWE-88).'),
        evidence: [server.command, ...args].join(' '), location: `mcpServers.${serverName}`,
        remediation: L('Fija mcp-server-git==2025.12.18 o superior y restringe --repository al proyecto.', 'Pin mcp-server-git==2025.12.18 or later and restrict --repository to the project.'), cwe: 'CWE-88',
      }))
    }
    return out
  },
}

export const dangerousContainer: Rule = {
  id: 'MCPS-FS-003', category: 'filesystem', name: { es: 'Contenedor sin aislamiento', en: 'Container without isolation' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const { cmd, args } = launcher(server)
    if (!['docker', 'podman'].includes(cmd)) return []
    const j = args.join(' ')
    const out: Finding[] = []
    const flags: [RegExp, string, string, Severity][] = [
      [/--privileged\b/, '--privileged (equivale a root en el host)', '--privileged (equivalent to root on the host)', 'critical'],
      [/(--network|--net)[ =]host\b/, '--network host (sin aislamiento de red)', '--network host (no network isolation)', 'high'],
      [/(docker|podman)\.sock/, 'socket de Docker montado (escape trivial)', 'Docker socket mounted (trivial escape)', 'critical'],
      [/--pid[ =]host\b/, '--pid host', '--pid host', 'high'],
    ]
    for (const [re, es, en, severity] of flags) if (re.test(j)) out.push(mk({
      ruleId: 'MCPS-FS-003', category: 'filesystem', severity, server: serverName, title: L(`Contenedor con ${es}`, `Container with ${en}`),
      detail: L('El contenedor no aporta aislamiento real: un servidor MCP comprometido alcanza el host.', 'The container gives no real isolation: a compromised MCP server reaches the host.'),
      evidence: j, location: `mcpServers.${serverName}.args`,
      remediation: L('Usa --network none, --read-only, --cap-drop ALL, --security-opt no-new-privileges y un usuario no root.', 'Use --network none, --read-only, --cap-drop ALL, --security-opt no-new-privileges and a non-root user.'), cwe: 'CWE-250',
    }))
    if (!out.length && !/--network[ =]none/.test(j)) out.push(mk({
      ruleId: 'MCPS-FS-003', category: 'filesystem', severity: 'low', server: serverName, title: L('Contenedor con red abierta por defecto', 'Container with open network by default'),
      detail: L('Sin --network none, un servidor comprometido puede exfiltrar datos libremente.', 'Without --network none, a compromised server can exfiltrate data freely.'),
      evidence: j, location: `mcpServers.${serverName}.args`,
      remediation: L('Si el servidor no necesita red, añade --network none; si la necesita (p. ej. una API remota), usa una red con egress allow-list.', 'If the server needs no network, add --network none; if it does (e.g. a remote API), use a network with an egress allow-list.'), cwe: 'CWE-284',
    }))
    return out
  },
}

export const filesystemRules: Rule[] = [excessiveMounts, dangerousContainer]
