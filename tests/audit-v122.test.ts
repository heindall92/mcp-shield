/** Regression tests for the external audit of v1.2.1. Each block reproduced the finding before the fix. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { scanConfig, scanText, ALL_RULES } from '../src/engine/scanner'
import { remediate } from '../src/engine/remediator'
import { redactValue } from '../src/engine/redact'
import { toSarif } from '../src/engine/sarifExporter'
import type { McpConfig } from '../src/types/mcp.types'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const UNKNOWN = 'Zq8vR2mT9xLp4KwN7cHsYb3D' // unknown-format credential: no known prefix, neutral key names

describe('P0-1 container hardening is allowlist-based', () => {
  const evil: McpConfig = { mcpServers: { box: { command: 'docker', args: ['run', '--user', 'root', '--network', 'bridge', '--read-only=false', '--privileged=true', '--cap-add', 'SYS_ADMIN', '--security-opt', 'seccomp=unconfined', '--security-opt', 'apparmor=unconfined', '--pid=host', '--ipc', 'host', '--device', '/dev/sda', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', '/etc:/host-etc', '--mount', 'type=bind,src=/root,dst=/r', 'ghcr.io/acme-fake/mcp:1.0.0', '--flag'] } } }
  const args = () => remediate(evil).mcpServers.box.args!
  it('drops every escalation flag', () => {
    const a = args()
    for (const bad of ['root', 'bridge', '--read-only=false', '--privileged', '--privileged=true', '--cap-add', 'SYS_ADMIN', '--pid', '--pid=host', '--ipc', 'host', '--device', '/dev/sda']) expect(a).not.toContain(bad)
    expect(a.join(' ')).not.toMatch(/unconfined|docker\.sock|\/etc|\/root/)
  })
  it('enforces the safe baseline', () => {
    const a = args()
    expect(a.slice(0, 2)).toEqual(['run', '--rm'])
    for (const [f, v] of [['--network', 'none'], ['--cap-drop', 'ALL'], ['--security-opt', 'no-new-privileges']]) expect(a[a.indexOf(f) + 1]).toBe(v)
    expect(a).toContain('--read-only')
    expect(a[a.indexOf('--user') + 1]).toMatch(/^[1-9]\d*:[1-9]\d*$/)
    expect(a.slice(-2)).toEqual(['ghcr.io/acme-fake/mcp:1.0.0', '--flag'])
  })
  it('re-scan of the hardened config has no critical/high container findings', () => {
    const r = scanConfig(remediate(evil))
    expect(r.findings.filter(f => f.ruleId === 'MCPS-FS-003' || f.ruleId === 'MCPS-FS-001').filter(f => f.severity === 'critical' || f.severity === 'high')).toEqual([])
  })
})

describe('P0-2 contextual redaction of unknown-format secrets', () => {
  const cfg: McpConfig = { mcpServers: { db: { command: 'npx', args: ['-y', '@acme-fake/db@1.0.0', '-e', `CONN=${UNKNOWN}`, '--env', `X=${UNKNOWN}`, '--pat', UNKNOWN, `--api-token=${UNKNOWN}`], env: { DB_CONN: UNKNOWN, DEBUG: 'true' } },
    r: { url: `https://api.example.com/mcp?code=${UNKNOWN}&page=2`, headers: { 'X-Client': UNKNOWN } } } }
  it('the "before" view hides them', () => { expect(JSON.stringify(redactValue(cfg))).not.toContain(UNKNOWN) })
  it('the hardened config hides them', () => { expect(JSON.stringify(remediate(cfg))).not.toContain(UNKNOWN) })
  it('keeps safe literals readable', () => {
    const s = JSON.stringify(redactValue(cfg))
    expect(s).toContain('"DEBUG":"true"'); expect(s).toContain('page=2'); expect(s).toContain('@acme-fake/db@1.0.0')
  })
})

describe('P0-3 rule failures are visible, never silent', () => {
  afterEach(() => vi.restoreAllMocks())
  it('a crashing rule yields ERROR status and no grade A', () => {
    vi.spyOn(ALL_RULES[0], 'check').mockImplementation(() => { throw new TypeError('boom with /secret/path') })
    const r = scanConfig({ mcpServers: { a: { command: 'node', args: ['srv.js'] } } }) as ReturnType<typeof scanConfig> & { coverage?: { ruleId: string; status: string; diagnostic?: string }[] }
    expect(r.grade).not.toBe('A')
    const c = r.coverage?.find(x => x.ruleId === ALL_RULES[0].id)
    expect(c?.status).toBe('ERROR')
    expect(c?.diagnostic ?? '').not.toContain('/secret/path')
  })
  it('a parse failure is not a clean grade A', () => { expect(scanText('{ nope').grade).not.toBe('A') })
})

describe('P1-4 tool-poisoning rules say when they could not run', () => {
  it('TP rules are NOT_EVALUATED without a tool inventory', () => {
    const r = scanConfig({ mcpServers: { a: { command: 'node', args: ['srv.js'] } } }) as unknown as { coverage?: { ruleId: string; status: string }[] }
    expect(r.coverage?.find(x => x.ruleId === 'MCPS-TP-001')?.status).toBe('NOT_EVALUATED')
  })
})

describe('P2-6 one version everywhere', () => {
  it('SARIF tool.driver.version matches package.json', () => {
    expect(toSarif(scanText('{"mcpServers":{}}')).runs[0].tool.driver.version).toBe(pkg.version)
  })
})
