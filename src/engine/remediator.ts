import type { McpConfig, McpServerConfig } from '../types/mcp.types'
import { launcher, volumeSource, runnerSubcommand, runnerPackage } from './rules/util'
import { poisoningRules } from './rules/poisoningRules'
import { smugglingRules } from './rules/smugglingRules'
import { isRef, isPlaceholder, findSecret, SECRET_KEY, redactString, isSafeLiteral, isSensitiveName, isFlag } from './redact'
import { scanConfig } from './scanner'
import { setOwn } from './ownKeys'
import type { Finding } from '../types/mcp.types'

const PIN_HINT = '1.0.0' // placeholder — user must replace with audited version
const PATCHED_GIT = 'mcp-server-git==2025.12.18'
const imageName = (pkg: string) => pkg.replace(/^@/, '').replace(/(==|@\d).*$/, '').replace(/[^a-z0-9._/-]+/gi, '-').toLowerCase().replace(/\//g, '-') || 'mcp-server'
const DOCKER_IMAGE = (pkg: string) => {
  const v = /(?:==|.@)v?(\d[\w.-]*)$/.exec(pkg)?.[1]
  return `mcp-sandbox/${imageName(pkg)}:${v && v !== PIN_HINT ? v : 'pinned'}`
}
const envName = (server: string, suffix: string) => `${server}_${suffix}`.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/** Every value becomes a `${NAME}` reference: real secrets never reach the fixed config. */
const refMap = (bag: Record<string, string> | undefined) =>
  Object.fromEntries(Object.entries(bag ?? {}).map(([k, v]) => [k, isRef(v) ? v : `\${${k}}`]))

function headerRefs(name: string, h: Record<string, string> | undefined) {
  if (!h) return undefined
  return Object.fromEntries(Object.entries(h).map(([k, v]) => {
    if (isRef(v) || isPlaceholder(v) || /\$\{[^}]+\}/.test(v)) return [k, v]
    const scheme = /^(Bearer|Basic|Token)\s+/i.exec(v)
    const secretish = scheme || SECRET_KEY.test(k) || findSecret(v) || !isSafeLiteral(v)
    return [k, secretish ? `${scheme ? scheme[1] + ' ' : ''}\${${envName(name, k.replace(/^x-/i, '') + (scheme ? '_TOKEN' : ''))}}` : redactString(v)]
  }))
}

/** Query values that are not known-safe literals become ${SERVER_PARAM} references. */
const urlRefs = (name: string, u: string) =>
  u.replace(/(:\/\/[^\s/@:]+:)([^\s@/]+)(@)/, (_, a, _pw, c) => `${a}\${${envName(name, 'PASSWORD')}}${c}`)
    .replace(/([?&])([^=&#\s]+)=([^&#\s]*)/g, (all, sep, k, v) => (isSafeLiteral(v) ? all : `${sep}${k}=\${${envName(name, k)}}`))

/** Replace sensitive args with env references, collecting the new env names. */
function argRefs(name: string, args: string[], env: Record<string, string>): string[] {
  const ref = (suffix: string) => { const v = envName(name, suffix); setOwn(env, v, `\${${v}}`); return `\${${v}}` }
  return args.map((a, i) => {
    if (isRef(a)) return a
    const prev = args[i - 1] ?? ''
    if (/^(-e|--env)$/.test(prev) || /^--env=/.test(a)) { // -e KEY=VAL (docker, many CLIs)
      const body = a.replace(/^--env=/, ''); const eq = body.indexOf('=')
      if (eq > 0) {
        const key = body.slice(0, eq), val = body.slice(eq + 1)
        if (!isSafeLiteral(val)) { setOwn(env, key, `\${${key}}`); return `${a.startsWith('--env=') ? '--env=' : ''}${key}` }
      }
      return a
    }
    const inline = /^(--?[A-Za-z][\w.-]*=)(.+)$/s.exec(a)
    if (inline && isSensitiveName(inline[1].slice(0, -1)) && !isSafeLiteral(inline[2])) return `${inline[1]}${ref(inline[1].replace(/^-+|=$/g, ''))}`
    if (isFlag(prev) && isSensitiveName(prev) && !a.startsWith('-') && !isSafeLiteral(a)) return ref(prev.replace(/^-+/, ''))
    if (findSecret(a)) return ref('SECRET')
    if (/[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i.test(a)) return ref('URL') // postgres://user:pass@host
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(a)) return urlRefs(name, a)
    return redactString(a)
  })
}

/* ── Container hardening: ALLOWLIST ────────────────────────────────────────────────────
 * The generated `docker run` is rebuilt from a safe baseline. Only options known to be harmless
 * survive; everything else (--user, --network, --privileged, --cap-add, --security-opt, --pid/--ipc/--uts/--userns,
 * --device, -p, --env-file, --volumes-from, --entrypoint, unknown flags…) is dropped. */
const BASELINE = ['--rm', '-i', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', '1000:1000']
/** Flags that take a separate value. Needed to find where the image starts. */
const VALUE_FLAGS = new Set(['-v', '--volume', '--mount', '-e', '--env', '--env-file', '--network', '--net', '--network-alias', '--pid', '--ipc', '--uts', '--userns', '--cgroupns', '--user', '-u', '--name', '-w', '--workdir', '--memory', '-m', '--memory-swap', '--pids-limit', '--cpus', '--cpu-shares', '-c', '--cap-drop', '--cap-add', '--security-opt', '--tmpfs', '--entrypoint', '-p', '--publish', '--expose', '--device', '--device-cgroup-rule', '--add-host', '--dns', '--dns-search', '--dns-option', '--group-add', '--label', '-l', '--label-file', '--hostname', '-h', '--volumes-from', '--runtime', '--platform', '--restart', '--ulimit', '--log-driver', '--log-opt', '--gpus', '--cidfile', '--sysctl', '--shm-size', '--stop-signal', '--stop-timeout', '--mac-address', '--ip', '--ip6', '--link', '--pull', '--storage-opt', '--health-cmd', '--health-interval', '--health-retries', '--health-timeout', '--health-start-period', '--isolation', '--kernel-memory', '--blkio-weight', '--cgroup-parent', '--detach-keys', '--domainname', '--oom-score-adj', '--attach', '-a', '--annotation'])
/** Allowlisted options and how to keep them. */
const KEEP_VALUE = new Set(['--name', '-w', '--workdir', '--memory', '-m', '--pids-limit', '--cpus', '--tmpfs', '-e', '--env', '-v', '--volume', '--mount', '--label', '-l', '--stop-timeout'])
const DANGEROUS_PATH = /^(\/|[A-Za-z]:[\\/]?|~|\$HOME|\$\{?HOME\}?|%USERPROFILE%|\/home\/[^/]+|\/Users\/[^/]+|[A-Za-z]:[\\/]Users[\\/][^\\/]+|\\\\.*)[\\/]?$|(^|[\\/])\.(ssh|aws|gnupg|kube|docker|config[\\/]gcloud|azure)([\\/]|$)|^\/(etc|root|boot|proc|sys|dev|run|var\/run|var\/lib\/docker)([\\/]|$)|(docker|podman|containerd)\.sock/i

export interface ContainerNote { kind: 'dropped' | 'network'; flag: string }
function hardenContainer(cmd: string, args: string[], env: Record<string, string>, notes: ContainerNote[]): McpServerConfig {
  const runIdx = args.indexOf('run')
  const run = runIdx >= 0 ? args.slice(runIdx + 1) : args
  if (runIdx > 0) notes.push({ kind: 'dropped', flag: args.slice(0, runIdx).filter(isFlag).join(' ') || 'global options' }) // global flags such as -H tcp://remote
  const keep: string[] = []
  let memory = '512m', pids = '128'
  let i = 0
  for (; i < run.length && run[i].startsWith('-'); i++) {
    const a = run[i]
    const eq = a.startsWith('--') ? a.indexOf('=') : -1
    const flag = eq > 0 ? a.slice(0, eq) : a
    const val = eq > 0 ? a.slice(eq + 1) : VALUE_FLAGS.has(flag) ? run[++i] : undefined
    if (/^-[a-z]{2,}$/.test(flag)) { // -it, -dit…
      if (!/^-[itd]+$/.test(flag)) notes.push({ kind: 'dropped', flag })
      continue
    }
    if (flag === '--rm' || flag === '-i' || flag === '--interactive' || flag === '-t' || flag === '--tty' || flag === '--init' || flag === '--read-only') continue // baseline sets these
    if (flag === '--network' || flag === '--net') { if (val !== 'none') notes.push({ kind: 'network', flag: `${flag} ${val && isSafeLiteral(val) ? val : ''}`.trim() }); continue }
    if (flag === '--memory' || flag === '-m') { if (val && /^\d+[bkmg]?$/i.test(val)) memory = val; continue }
    if (flag === '--pids-limit') { if (val && /^[1-9]\d{0,4}$/.test(val)) pids = val; continue }
    if (!KEEP_VALUE.has(flag) || val === undefined) { notes.push({ kind: 'dropped', flag: val !== undefined && !/^(-e|--env|--env-file)$/.test(flag) && isSafeLiteral(val) ? `${flag} ${val}` : flag }); continue }
    if (flag === '-e' || flag === '--env') {
      const k = val.split('=')[0]
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) { notes.push({ kind: 'dropped', flag }); continue }
      if (val.includes('=')) { const v = val.slice(k.length + 1); setOwn(env, k, isRef(v) ? v : `\${${k}}`) }
      keep.push('-e', k); continue
    }
    if (flag === '-v' || flag === '--volume') {
      const src = volumeSource(val)
      if (DANGEROUS_PATH.test(src) || !src) { notes.push({ kind: 'dropped', flag: `${flag} ${isSafeLiteral(src) ? src : ''}`.trim() }); continue }
      const parts = val.slice(src.length + 1).split(':')
      keep.push('-v', `${src}:${parts[0]}:ro`); continue
    }
    if (flag === '--mount') {
      const srcs = [...val.matchAll(/(?:^|,)(?:src|source)=([^,]+)/g)].map(m => m[1])
      if (/type=(?!bind|volume|tmpfs)/.test(val) || srcs.some(x => DANGEROUS_PATH.test(x)) || /bind-propagation=(r?shared)/.test(val)) { notes.push({ kind: 'dropped', flag: `--mount ${srcs.filter(isSafeLiteral).join(',')}`.trim() }); continue }
      keep.push('--mount', /(^|,)(readonly|ro)(=true|=1)?(,|$)/.test(val) ? val.replace(/(^|,)(readonly|ro)=(false|0)/, '') : `${val.replace(/(^|,)(readonly|ro)=(false|0)/, '')},readonly`); continue
    }
    keep.push(flag, val)
  }
  const rest = run.slice(i)
  return { command: cmd, args: ['run', ...BASELINE, '--pids-limit', pids, '--memory', memory, ...keep, ...rest], ...(Object.keys(env).length ? { env } : {}) }
}

export function hardenServer(name: string, s: McpServerConfig, notes: ContainerNote[] = []): McpServerConfig {
  const env = refMap(s.env)
  if (s.url) {
    const u = redactString(urlRefs(name, s.url.trim()).replace(/^http:\/\/(?!(localhost|127\.0\.0\.1|\[::1\])(:|\/|$))/i, 'https://').replace(/^ws:\/\/(?!(localhost|127\.0\.0\.1)(:|\/|$))/i, 'wss://'))
    const headers = headerRefs(name, s.headers)
    return { ...(s.type ? { type: s.type } : {}), url: u, ...(headers ? { headers } : {}), ...(Object.keys(env).length ? { env } : {}) }
  }
  const launched = launcher(s)
  // npm exec / npm x / bun x / pnpm dlx / yarn dlx behave like npx: drop the subcommand so "exec" is not taken for the package
  const sub = runnerSubcommand(launched.cmd, launched.args[0])
  const cmd = sub ? 'npx' : launched.cmd
  const args = argRefs(name, sub ? launched.args.slice(1) : launched.args, env)
  if (cmd === 'docker' || cmd === 'podman') return hardenContainer(cmd, args, env, notes)
  const filtered = args.filter(a => a !== '-y' && a !== '--yes' && a !== '--')
  const found = runnerPackage(filtered)
  const pkgIdx = found ? found.idx : -1
  let pkg = found ? found.pkg : name
  if (['npx', 'bunx', 'pnpx'].includes(cmd) && pkgIdx >= 0 && !/@\d/.test(pkg.replace(/^@/, ''))) pkg = `${pkg.replace(/@latest$/, '')}@${PIN_HINT}`
  if (cmd === 'uvx' && pkgIdx >= 0 && !/(==|@)\d/.test(pkg)) pkg = pkg === 'mcp-server-git' ? PATCHED_GIT : `${pkg.replace(/@latest$/, '')}==${PIN_HINT}`
  if (cmd === 'uvx' && /^mcp-server-git(==|@)/.test(pkg) && !/(==|@)(2025\.12\.(1[89]|[23]\d)|202[6-9])/.test(pkg)) pkg = PATCHED_GIT
  const rest = filtered.slice(pkgIdx + 1).map(a => (/^(\/|[A-Za-z]:\\|~)/.test(a) ? '/workspace' : a))
  const dockerArgs = ['run', '--rm', '-i', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '128', '--memory', '256m', '--user', '1000:1000',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '-v', '${PWD}:/workspace:ro',
    ...Object.keys(env).flatMap(k => ['-e', k]), DOCKER_IMAGE(pkg), ...rest]
  return { command: 'docker', args: dockerArgs, ...(Object.keys(env).length ? { env } : {}) }
}

/** A server is dropped when the scanner's own poisoning rules flag it (single source of truth). */
const isPoisoned = (name: string, s: McpServerConfig) =>
  [...poisoningRules, ...smugglingRules].some(r => r.check({ serverName: name, server: s, lang: 'es' }).some(f => f.severity === 'critical'))

export function remediate(cfg: McpConfig, notes: (ContainerNote & { server: string })[] = []): McpConfig {
  const out: McpConfig = { mcpServers: {} }
  for (const [n, s] of Object.entries(cfg.mcpServers)) {
    if (isPoisoned(n, s)) continue
    const local: ContainerNote[] = []
    setOwn(out.mcpServers, n, hardenServer(n, s, local))
    notes.push(...local.map(x => ({ ...x, server: n })))
  }
  return out
}

export function removedServers(cfg: McpConfig): string[] {
  return Object.entries(cfg.mcpServers).filter(([n, s]) => isPoisoned(n, s)).map(([n]) => n)
}

export function dockerSnippet(cfg: McpConfig, lang: 'es' | 'en' = 'es'): string {
  const en = lang === 'en'
  const first = Object.entries(cfg.mcpServers).find(([n, s]) => {
    const c = launcher(s).cmd
    return s.command && c !== 'docker' && c !== 'podman' && !isPoisoned(n, s)
  })
  const L0 = first ? launcher(first[1]) : { cmd: 'npx', args: [] as string[] }
  // Same reading as hardenServer: npm exec / bun x / dlx are npx, and the package may come from --package / -p
  const L = runnerSubcommand(L0.cmd, L0.args[0]) ? { cmd: 'npx', args: L0.args.slice(1) } : L0
  const raw = runnerPackage(L.args)?.pkg ?? first?.[0] ?? 'mcp-server'
  const python = L.cmd === 'uvx' || L.cmd === 'python' || L.cmd === 'python3' || L.cmd === 'uv'
  const header = `# Dockerfile — ${en ? 'sandbox for an MCP server (generated by MCP-Shield)' : 'sandbox para servidor MCP (generado por MCP-Shield)'}`
  let dockerfile: string
  if (python) {
    const name = raw.replace(/(==|@).*$/, '')
    const spec = name === 'mcp-server-git' ? PATCHED_GIT : /(==|@)\d/.test(raw) ? raw.replace('@', '==') : `${name}==${PIN_HINT}`
    dockerfile = `${header}
FROM python:3.12-slim@sha256:${en ? '<audited-digest>' : '<digest-auditado>'}
RUN useradd --create-home --uid 1000 mcp
# ${en ? 'EXACT version (use --require-hashes with a lock file)' : 'Versión EXACTA (usa --require-hashes con un lock file)'}
RUN pip install --no-cache-dir "${spec}"
USER mcp
ENTRYPOINT ["${name}"]`
  } else {
    const base = raw.replace(/@latest$/, '')
    const bin = base.replace(/(.)@.*$/, '$1')
    dockerfile = `${header}
FROM node:22-alpine@sha256:${en ? '<audited-digest>' : '<digest-auditado>'}
RUN addgroup -S mcp && adduser -S mcp -G mcp
WORKDIR /app
# ${en ? 'EXACT version + lockfile: no silent rug-pulls' : 'Versión EXACTA + lockfile: sin rug-pulls silenciosos'}
RUN npm install --omit=dev --ignore-scripts ${base.includes('@', 1) ? base : base + '@' + PIN_HINT}
USER mcp
ENTRYPOINT ["npx", "--no-install", "${bin}"]`
  }
  return `${dockerfile}

# docker-compose.yml
services:
  mcp-sandbox:
    build: .
    network_mode: "none"          # ${en ? 'no egress: exfiltration fails' : 'sin egress: la exfiltración falla'}
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    pids_limit: 128
    mem_limit: 256m
    tmpfs: ["/tmp:rw,noexec,nosuid,size=16m"]
    volumes:
      - ./workspace:/workspace:ro # ${en ? 'never /, C:\\ or ~/.ssh' : 'nunca /, C:\\ ni ~/.ssh'}
    stdin_open: true
`
}

export interface HardeningVerdict {
  /** 'hardened' only when a re-scan of the generated config finds zero critical/high issues. */
  status: 'hardened' | 'partial'
  remaining: Finding[]
  /** Options removed from container commands; kind 'network' means the original asked for a network. */
  notes: (ContainerNote & { server: string })[]
  config: McpConfig
}
/** Generate the hardened config and RE-SCAN it with the same rules: the label is earned, not assumed. */
export function hardeningVerdict(cfg: McpConfig, lang: 'es' | 'en' = 'es'): HardeningVerdict {
  const notes: HardeningVerdict['notes'] = []
  const config = remediate(cfg, notes)
  const res = scanConfig(config, lang)
  const remaining = res.findings.filter(f => f.severity === 'critical' || f.severity === 'high')
  return { status: remaining.length || res.coverage.some(c => c.status === 'ERROR') ? 'partial' : 'hardened', remaining, notes, config }
}
