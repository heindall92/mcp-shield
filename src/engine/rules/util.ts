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

/** `pnpm dlx`, `yarn dlx`, `npm exec`, `npm x` and `bun x` fetch and run a package exactly like npx. */
export const runnerSubcommand = (cmd: string, first: string | undefined): boolean =>
  ((cmd === 'pnpm' || cmd === 'yarn') && first === 'dlx') || (cmd === 'npm' && (first === 'exec' || first === 'x')) || (cmd === 'bun' && first === 'x')

/**
 * Package a runner fetches and runs (npx, bunx, pnpx, uvx, npm exec, bun x, pnpm/yarn dlx), with its index in args.
 * `--package=pkg`, `--package pkg` and `-p pkg` name it explicitly; otherwise it is the first positional argument.
 * The values of --from/--with/--python/--registry/--cache are skipped, and so is the `--` separator.
 */
export function runnerPackage(args: string[]): { pkg: string; idx: number } | null {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (/^--package=./.test(a)) return { pkg: a.slice('--package='.length), idx: i }
    if (a === '-p' || a === '--package') {
      const v = args[i + 1]
      if (v !== undefined && !v.startsWith('-')) return { pkg: v, idx: i + 1 }
      continue
    }
    if (['--from', '--with', '--python', '--registry', '--cache'].includes(a)) { i++; continue }
    if (!a.startsWith('-')) return { pkg: a, idx: i }
  }
  return null
}

/** Host side of a `-v` spec, Windows-aware: `C:\\Users\\me:/data:ro` -> `C:\\Users\\me`, `/etc:/x` -> `/etc`. */
export function volumeSource(spec: string): string {
  const v = spec.trim()
  const drive = /^[A-Za-z]:[\\/]/.test(v) ? 2 : 0
  const i = v.indexOf(':', drive)
  return i < 0 ? v : v.slice(0, i)
}
