import type { Finding, McpServerConfig, RuleCategory, Severity } from '../../types/mcp.types'
let n = 0
export const mk = (f: Omit<Finding, 'id'>): Finding => ({ id: `F-${++n}`, ...f })
export const sev = (s: Severity) => s
export type { RuleCategory }

/**
 * Effective launcher: unwraps Windows `cmd /c npx …`, `wsl …` and `.cmd`/`.exe` suffixes,
 * so `"command": "cmd", "args": ["/c","npx","-y","pkg"]` is analysed like `npx -y pkg`.
 */
export function launcher(s: McpServerConfig): { cmd: string; args: string[]; offset: number } {
  const base = (c: string) => (c.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.(cmd|exe|bat|ps1)$/, '')
  let cmd = base(s.command ?? '')
  let args = s.args ?? []
  let offset = 0
  for (let guard = 0; guard < 3; guard++) {
    if ((cmd === 'cmd' || cmd === 'powershell' || cmd === 'pwsh') && /^[/-]c(ommand)?$/i.test(args[0] ?? '')) {
      const rest = args.slice(1)
      // "cmd /c npx -y pkg" may also come as a single string
      const parts = rest.length === 1 ? rest[0].split(/\s+/) : rest
      cmd = base(parts[0] ?? ''); args = parts.slice(1); offset += rest.length === 1 ? 1 : 2
    } else if (cmd === 'wsl' && args.length) { cmd = base(args[0]); args = args.slice(1); offset += 1 }
    else break
  }
  return { cmd, args, offset }
}
