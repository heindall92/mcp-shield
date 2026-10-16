import type { McpConfig, McpServerConfig } from '../types/mcp.types'
import { launcher } from './rules/util'
import { poisoningRules } from './rules/poisoningRules'
import { isRef, isPlaceholder, findSecret, SECRET_KEY, redactString } from './redact'

const PIN_HINT = '1.0.0' // placeholder — user must replace with audited version
const PATCHED_GIT = 'mcp-server-git==2025.12.18'
const imageName = (pkg: string) => pkg.replace(/^@/, '').replace(/(==|@\d).*$/, '').replace(/[^a-z0-9._/-]+/gi, '-').toLowerCase().replace(/\//g, '-') || 'mcp-server'
const DOCKER_IMAGE = (pkg: string) => {
  const v = /(?:==|.@)v?(\d[\w.-]*)$/.exec(pkg)?.[1]
  return `mcp-sandbox/${imageName(pkg)}:${v && v !== PIN_HINT ? v : 'pinned'}`
}
const envName = (server: string, suffix: string) => `${server}_${suffix}`.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const DANGEROUS_PATH = /^(\/|[A-Za-z]:\\?|~|\$HOME|\/home\/[^/]+|\/Users\/[^/]+|C:\\Users\\[^\\]+)[\\/]?$|(^|[\\/])\.(ssh|aws|gnupg|kube|docker)([\\/]|$)|^\/(etc|root|boot|proc|sys|run|var\/run)([\\/]|$)|(docker|podman)\.sock/

/** Every value becomes a `${NAME}` reference: real secrets never reach the fixed config. */
const refMap = (bag: Record<string, string> | undefined) =>
  Object.fromEntries(Object.entries(bag ?? {}).map(([k, v]) => [k, isRef(v) ? v : `\${${k}}`]))

function headerRefs(name: string, h: Record<string, string> | undefined) {
  if (!h) return undefined
  return Object.fromEntries(Object.entries(h).map(([k, v]) => {
    if (isRef(v) || isPlaceholder(v) || /\$\{[^}]+\}/.test(v)) return [k, v]
    const scheme = /^(Bearer|Basic|Token)\s+/i.exec(v)
    const secretish = scheme || SECRET_KEY.test(k) || findSecret(v)
    return [k, secretish ? `${scheme ? scheme[1] + ' ' : ''}\${${envName(name, k.replace(/^x-/i, '') + (scheme ? '_TOKEN' : ''))}}` : redactString(v)]
  }))
}

/** Replace secret-looking args with env references, collecting the new env names. */
function argRefs(name: string, args: string[], env: Record<string, string>): string[] {
  return args.map((a, i) => {
    if (isRef(a)) return a
    const inline = /^(--?[\w-]*(?:token|key|secret|password)[\w-]*=)(.+)$/i.exec(a)
    if (inline && !isRef(inline[2])) { const v = envName(name, inline[1].replace(/^-+|=$/g, '')); env[v] = `\${${v}}`; return `${inline[1]}\${${v}}` }
    const afterFlag = i > 0 && /^--?[\w-]*(token|key|secret|password)[\w-]*$/i.test(args[i - 1]) && a.length >= 8
    if (afterFlag || findSecret(a)) { const v = envName(name, afterFlag ? args[i - 1].replace(/^-+/, '') : 'SECRET'); env[v] = `\${${v}}`; return `\${${v}}` }
    if (/[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i.test(a)) { const v = envName(name, 'URL'); env[v] = `\${${v}}`; return `\${${v}}` } // postgres://user:pass@host
    return redactString(a)
  })
}

const FLAGS_WITH_VALUE = new Set(['-v', '--volume', '--mount', '-e', '--env', '--network', '--net', '--pid', '--user', '-u', '--name', '-w', '--workdir', '--memory', '-m', '--pids-limit', '--cap-drop', '--cap-add', '--security-opt', '--tmpfs', '--entrypoint', '--env-file', '-p', '--publish'])

/** Server already launched through docker/podman: keep its image and env, strip escapes, enforce hardening flags. */
function hardenContainer(cmd: string, args: string[], env: Record<string, string>): McpServerConfig {
  const runIdx = args.indexOf('run')
  const pre = runIdx >= 0 ? args.slice(0, runIdx) : []
  const run = runIdx >= 0 ? args.slice(runIdx + 1) : args
  const opts: string[] = []
  let i = 0
  for (; i < run.length && run[i].startsWith('-'); i++) {
    const a = run[i]
    const [flag, inlineVal] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined]
    const val = inlineVal ?? (FLAGS_WITH_VALUE.has(flag) ? run[++i] : undefined)
    if (flag === '--privileged' || flag === '--cap-add') continue
    if ((flag === '--network' || flag === '--net' || flag === '--pid') && val === 'host') continue
    if ((flag === '-v' || flag === '--volume') && val && DANGEROUS_PATH.test(val.split(':')[0])) continue
    if (flag === '--mount' && val && [...val.matchAll(/(?:^|,)(?:src|source)=([^,]+)/g)].some(m => DANGEROUS_PATH.test(m[1]))) continue
    opts.push(...(inlineVal !== undefined ? [a] : val !== undefined ? [flag, val] : [flag]))
  }
  const rest = run.slice(i)
  const has = (f: string) => opts.some(o => o === f || o.startsWith(f + '='))
  const add: string[] = []
  if (!has('--rm')) add.push('--rm')
  if (!has('-i') && !has('--interactive')) add.push('-i')
  if (!has('--read-only')) add.push('--read-only')
  if (!has('--cap-drop')) add.push('--cap-drop', 'ALL')
  if (!opts.some(o => /no-new-privileges/.test(o))) add.push('--security-opt', 'no-new-privileges')
  if (!has('--pids-limit')) add.push('--pids-limit', '128')
  if (!has('--memory') && !has('-m')) add.push('--memory', '512m')
  if (!has('--user') && !has('-u')) add.push('--user', '1000:1000')
  return { command: cmd, args: [...pre, 'run', ...add, ...opts, ...rest], ...(Object.keys(env).length ? { env } : {}) }
}

export function hardenServer(name: string, s: McpServerConfig): McpServerConfig {
  const env = refMap(s.env)
  if (s.url) {
    const u = redactString(s.url.trim().replace(/^http:\/\/(?!(localhost|127\.0\.0\.1|\[::1\])(:|\/|$))/i, 'https://').replace(/^ws:\/\/(?!(localhost|127\.0\.0\.1)(:|\/|$))/i, 'wss://'))
    const headers = headerRefs(name, s.headers)
    return { ...(s.type ? { type: s.type } : {}), url: u, ...(headers ? { headers } : {}), ...(Object.keys(env).length ? { env } : {}) }
  }
  const { cmd, args: rawArgs } = launcher(s)
  const args = argRefs(name, rawArgs, env)
  if (cmd === 'docker' || cmd === 'podman') return hardenContainer(cmd, args, env)
  const filtered = args.filter(a => a !== '-y' && a !== '--yes')
  const pkgIdx = filtered.findIndex((a, i) => !a.startsWith('-') && !(i > 0 && /^(--from|--with|-p|--package|--python)$/.test(filtered[i - 1])))
  let pkg = pkgIdx >= 0 ? filtered[pkgIdx] : name
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
  poisoningRules.some(r => r.check({ serverName: name, server: s, lang: 'es' }).some(f => f.severity === 'critical'))

export function remediate(cfg: McpConfig): McpConfig {
  const out: McpConfig = { mcpServers: {} }
  for (const [n, s] of Object.entries(cfg.mcpServers)) {
    if (isPoisoned(n, s)) continue
    out.mcpServers[n] = hardenServer(n, s)
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
  const L = first ? launcher(first[1]) : { cmd: 'npx', args: [] as string[] }
  const raw = L.args.find((a, i) => !a.startsWith('-') && !(i > 0 && /^(--from|--with|-p|--package|--python)$/.test(L.args[i - 1]))) ?? first?.[0] ?? 'mcp-server'
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
