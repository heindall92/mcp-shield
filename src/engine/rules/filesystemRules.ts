import type { Rule, Finding, Severity } from '../../types/mcp.types'
import { mk } from './util'

const DANGEROUS: { re: RegExp; label: string; sev: Severity }[] = [
  { re: /^\/$/, label: 'raíz del sistema (/)', sev: 'critical' },
  { re: /^[A-Za-z]:\\?$/, label: 'unidad completa (C:\\)', sev: 'critical' },
  { re: /(^|[\\/])\.ssh([\\/]|$)/, label: 'claves SSH (~/.ssh)', sev: 'critical' },
  { re: /(^|[\\/])\.(aws|gnupg|kube|docker)([\\/]|$)/, label: 'credenciales cloud/GPG/kube', sev: 'critical' },
  { re: /^(~|\$HOME|\/home\/[^/]+|\/Users\/[^/]+|C:\\Users\\[^\\]+)[\\/]?$/i, label: 'home completo del usuario', sev: 'high' },
  { re: /^\/(etc|root|var)([\\/]|$)/, label: 'directorio de sistema', sev: 'high' },
]

export const excessiveMounts: Rule = {
  id: 'MCPS-FS-001', category: 'filesystem', name: 'Exposición excesiva del sistema de ficheros',
  check: ({ serverName, server }) => {
    const out: Finding[] = []
    const args = server.args ?? []
    args.forEach((raw, i) => {
      const a = raw.replace(/^--?[\w-]+=/, '').replace(/^.*:(?=\/)/, '') // handle --root=/ and docker -v /:/host
      const vol = raw.includes(':/') && args[i - 1] === '-v' ? raw.split(':')[0] : a
      const hit = DANGEROUS.find(d => d.re.test(vol))
      if (hit) out.push(mk({
        ruleId: 'MCPS-FS-001', category: 'filesystem', severity: hit.sev, server: serverName,
        title: `Acceso a ${hit.label}`,
        detail: 'Un servidor MCP con este alcance permite que una inyección de prompt o una vulnerabilidad de argument injection (clase CVE-2025-68144, CWE-88) lea o sobrescriba ficheros sensibles fuera del proyecto.',
        evidence: raw, location: `mcpServers.${serverName}.args[${i}]`,
        remediation: 'Limita el servidor al directorio del proyecto (./workspace) y ejecútalo en contenedor con montaje read-only.',
        cwe: 'CWE-22',
      }))
    })
    const name = serverName.toLowerCase() + ' ' + args.join(' ')
    if (/mcp-server-git/.test(name)) {
      const pinnedSafe = args.some(a => /mcp-server-git==(2025\.(12\.(1[89]|[23]\d)|)|202[6-9])/.test(a))
      if (!pinnedSafe) out.push(mk({
        ruleId: 'MCPS-FS-002', category: 'filesystem', severity: 'high', server: serverName,
        title: 'mcp-server-git sin versión parcheada ≥ 2025.12.18 (CVE-2025-68144)',
        detail: 'Versiones anteriores pasaban argumentos de git_diff/git_checkout sin sanear: valores tipo "--output=<ruta>" permitían sobrescribir ficheros locales (CWE-88).',
        evidence: [server.command, ...args].join(' '), location: `mcpServers.${serverName}`,
        remediation: 'Fija mcp-server-git==2025.12.18 o superior y restringe --repository al proyecto.', cwe: 'CWE-88',
      }))
    }
    return out
  },
}

export const dangerousContainer: Rule = {
  id: 'MCPS-FS-003', category: 'filesystem', name: 'Contenedor sin aislamiento',
  check: ({ serverName, server }) => {
    const cmd = (server.command ?? '').split(/[\\/]/).pop() ?? ''
    if (!['docker', 'podman'].includes(cmd)) return []
    const args = server.args ?? []
    const out: Finding[] = []
    const j = args.join(' ')
    const flags: [RegExp, string, Severity][] = [
      [/--privileged\b/, '--privileged (equivale a root en el host)', 'critical'],
      [/(--network|--net)[ =]host\b/, '--network host (sin aislamiento de red)', 'high'],
      [/docker\.sock/, 'socket de Docker montado (escape trivial)', 'critical'],
      [/--pid[ =]host\b/, '--pid host', 'high'],
    ]
    for (const [re, label, severity] of flags) if (re.test(j)) out.push(mk({
      ruleId: 'MCPS-FS-003', category: 'filesystem', severity, server: serverName, title: `Contenedor con ${label}`,
      detail: 'El contenedor no aporta aislamiento real: un servidor MCP comprometido alcanza el host.',
      evidence: j, location: `mcpServers.${serverName}.args`,
      remediation: 'Usa --network none, --read-only, --cap-drop ALL, --security-opt no-new-privileges y un usuario no root.', cwe: 'CWE-250',
    }))
    if (!out.length && !/--network[ =]none/.test(j)) out.push(mk({
      ruleId: 'MCPS-FS-003', category: 'filesystem', severity: 'medium', server: serverName, title: 'Contenedor con red abierta por defecto',
      detail: 'Sin --network none, un servidor comprometido puede exfiltrar datos libremente.',
      evidence: j, location: `mcpServers.${serverName}.args`,
      remediation: 'Añade --network none (o una red con egress allow-list).', cwe: 'CWE-284',
    }))
    return out
  },
}

export const filesystemRules: Rule[] = [excessiveMounts, dangerousContainer]
