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

/** `docker run` / `podman run` options that take a separate value. Shared by MCPS-SC-004 and the container hardening to find where the image starts. */
export const VALUE_FLAGS = new Set(['-v', '--volume', '--mount', '-e', '--env', '--env-file', '--network', '--net', '--network-alias', '--pid', '--ipc', '--uts', '--userns', '--cgroupns', '--user', '-u', '--name', '-w', '--workdir', '--memory', '-m', '--memory-swap', '--pids-limit', '--cpus', '--cpu-shares', '-c', '--cap-drop', '--cap-add', '--security-opt', '--tmpfs', '--entrypoint', '-p', '--publish', '--expose', '--device', '--device-cgroup-rule', '--add-host', '--dns', '--dns-search', '--dns-option', '--group-add', '--label', '-l', '--label-file', '--hostname', '-h', '--volumes-from', '--runtime', '--platform', '--restart', '--ulimit', '--log-driver', '--log-opt', '--gpus', '--cidfile', '--sysctl', '--shm-size', '--stop-signal', '--stop-timeout', '--mac-address', '--ip', '--ip6', '--link', '--pull', '--storage-opt', '--health-cmd', '--health-interval', '--health-retries', '--health-timeout', '--health-start-period', '--isolation', '--kernel-memory', '--blkio-weight', '--cgroup-parent', '--detach-keys', '--domainname', '--oom-score-adj', '--attach', '-a', '--annotation'])
/** Global docker/podman options (before the subcommand) that take a value, such as `-H tcp://host`. */
const GLOBAL_VALUE_FLAGS = new Set(['-H', '--host', '-c', '--context', '--config', '-l', '--log-level', '--tlscacert', '--tlscert', '--tlskey', '--url', '--connection', '--root', '--runroot'])

/** Image of a `docker|podman [global options] [container] run [options] IMAGE [args]` argv, with its index; null for other subcommands. */
export function containerImage(args: string[]): { image: string; idx: number } | null {
  let i = 0
  for (; i < args.length && args[i].startsWith('-'); i++) if (GLOBAL_VALUE_FLAGS.has(args[i])) i++
  if (args[i] === 'container') i++
  if (args[i] !== 'run') return null
  for (i++; i < args.length; i++) {
    const a = args[i]
    if (a === '--') { i++; break }
    if (!a.startsWith('-')) break
    if (!a.includes('=') && VALUE_FLAGS.has(a)) i++
  }
  return i < args.length ? { image: args[i], idx: i } : null
}

/** Pinned by content: `name@sha256:<64 hex>` (with or without a tag). */
export const imagePinned = (image: string) => /@sha256:[0-9a-f]{64}$/i.test(image)
/** Tag of an image reference; a registry port (`localhost:5000/img`) is not a tag. Empty when there is none. */
export const imageTag = (image: string) => { const ref = image.replace(/@.*$/, ''); const c = ref.indexOf(':', ref.lastIndexOf('/') + 1); return c < 0 ? '' : ref.slice(c + 1) }
/** Repository of an image reference, without tag or digest (`localhost:5000/img:1.0@sha256:…` → `localhost:5000/img`). */
export const imageName = (image: string) => { const ref = image.replace(/@.*$/, ''); const c = ref.indexOf(':', ref.lastIndexOf('/') + 1); return c < 0 ? ref : ref.slice(0, c) }
