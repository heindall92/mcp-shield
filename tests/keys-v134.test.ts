/** Regression tests for v1.3.4. Each block reproduced the problem before the fix. */
import { describe, it, expect } from 'vitest'
import { parseMcp } from '../src/engine/parse'
import { scanText, scanConfig } from '../src/engine/scanner'
import { mergeTools } from '../src/engine/toolsImport'
import { remediate } from '../src/engine/remediator'
import { redactValue } from '../src/engine/redact'
import { toSarif } from '../src/engine/sarifExporter'

const TOKEN = 'ghp_FAKEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const evil = (name: string) => `{"mcpServers":{"${name}":{"command":"npx","args":["-y","evil-pkg","/"],"env":{"GITHUB_TOKEN":"${TOKEN}"}},"ok":{"command":"node","args":["s.js"]}}}`
// Names that collide with Object.prototype. JSON.parse keeps them as own keys, so an MCP client launches these servers.
const PROTO_NAMES = ['__proto__', 'constructor', 'hasOwnProperty', 'toString', 'valueOf', 'isPrototypeOf', '__defineGetter__']

describe('server names that collide with Object.prototype are audited, not hidden', () => {
  it('a client sees the server: JSON.parse keeps "__proto__" as an own key', () => {
    expect(Object.keys(JSON.parse(evil('__proto__')).mcpServers)).toEqual(['__proto__', 'ok'])
  })
  for (const n of PROTO_NAMES) it(`"${n}" is parsed, scanned and graded`, () => {
    const p = parseMcp(evil(n))
    expect(Object.keys(p.config!.mcpServers)).toEqual([n, 'ok'])
    const r = scanText(evil(n))
    expect(r.serversScanned).toBe(2)
    const ids = r.findings.filter(f => f.server === n).map(f => f.ruleId)
    for (const id of ['MCPS-SC-001', 'MCPS-FS-001', 'MCPS-SEC-001']) expect(ids).toContain(id)
    expect(r.grade).not.toBe('A')
  })
  it('env and header keys named "__proto__" keep their value and are scanned', () => {
    const cfg = parseMcp(`{"mcpServers":{"a":{"url":"https://x.example/mcp","env":{"__proto__":"${TOKEN}"},"headers":{"__proto__":"Bearer ${TOKEN}"}}}}`).config!
    expect(Object.keys(cfg.mcpServers.a.env!)).toEqual(['__proto__'])
    expect(Object.keys(cfg.mcpServers.a.headers!)).toEqual(['__proto__'])
    expect(scanConfig(cfg).findings.filter(f => f.ruleId === 'MCPS-SEC-001').length).toBeGreaterThan(0)
  })
  it('the redacted "before" view keeps the server and hides the token', () => {
    const v = redactValue(parseMcp(evil('__proto__')).config!)
    expect(Object.keys(v.mcpServers)).toEqual(['__proto__', 'ok'])
    expect(JSON.stringify(v)).not.toContain(TOKEN)
  })
  it('the hardened config keeps the server, pinned and with a ${VAR} reference', () => {
    const out = remediate(parseMcp(evil('__proto__')).config!)
    const txt = JSON.stringify(out)
    expect(Object.keys(out.mcpServers)).toEqual(['__proto__', 'ok'])
    expect(txt).not.toContain(TOKEN)
    expect(out.mcpServers['__proto__'].args).not.toContain('-y')
  })
  it('SARIF reports the finding on that server', () => {
    const sarif = toSarif(scanText(evil('__proto__')))
    expect(JSON.stringify(sarif)).toContain('mcpServers.__proto__')
  })
  it('no global prototype pollution', () => {
    scanText(evil('__proto__')); remediate(parseMcp(evil('__proto__')).config!)
    expect(({} as Record<string, unknown>).command).toBeUndefined()
    expect(({} as Record<string, unknown>).args).toBeUndefined()
  })
})

describe('mergeTools does not read inherited properties', () => {
  for (const n of PROTO_NAMES) it(`server "${n}" with no imported inventory does not crash`, () => {
    const cfg = parseMcp(`{"mcpServers":{"${n}":{"command":"node"}}}`).config!
    expect(Object.keys(mergeTools(cfg, {}).mcpServers)).toEqual([n])
  })
  it('an inventory imported for "constructor" is merged', () => {
    const cfg = parseMcp('{"mcpServers":{"constructor":{"command":"node"}}}').config!
    const merged = mergeTools(cfg, Object.fromEntries([['constructor', [{ name: 'read', description: 'Read a file' }]]]))
    expect(merged.mcpServers.constructor.tools?.map(t => t.name)).toEqual(['read'])
  })
})

describe('MCPS-SC-001 covers npm exec / npm x and bun x', () => {
  const sc = (command: string, args: string[]) => scanConfig({ mcpServers: { s: { command, args } } }).findings.filter(f => f.ruleId === 'MCPS-SC-001')
  it('npm exec -y pkg', () => { expect(sc('npm', ['exec', '-y', 'evil-pkg'])[0]?.severity).toBe('high') })
  it('npm x --yes pkg', () => { expect(sc('npm', ['x', '--yes', 'evil-pkg'])).toHaveLength(1) })
  it('npm exec -- pkg (separator)', () => { expect(sc('npm', ['exec', '--', 'evil-pkg'])).toHaveLength(1) })
  it('npm exec --package=pkg cmd', () => { expect(sc('npm', ['exec', '--package=evil-pkg', '--', 'evil'])).toHaveLength(1) })
  it('bun x pkg', () => { expect(sc('bun', ['x', 'evil-pkg'])).toHaveLength(1) })
  it('pinned versions pass', () => {
    expect(sc('npm', ['exec', '-y', '@modelcontextprotocol/server-memory@2025.9.25'])).toHaveLength(0)
    expect(sc('npm', ['exec', '--package=evil-pkg@1.2.3', '--', 'evil'])).toHaveLength(0)
    expect(sc('bun', ['x', 'evil-pkg@1.2.3'])).toHaveLength(0)
  })
  it('npm run / npm start are not package executions', () => {
    expect(sc('npm', ['run', 'start'])).toHaveLength(0)
    expect(sc('npm', ['start'])).toHaveLength(0)
  })
})

describe('the hardened config handles npm exec / bun x / pnpm dlx like npx', () => {
  const img = (command: string, args: string[]) => remediate({ mcpServers: { s: { command, args } } }).mcpServers.s.args!.find(a => a.startsWith('mcp-sandbox/'))
  it('the image is named after the package, not the subcommand', () => {
    expect(img('npm', ['exec', '-y', 'evil-pkg'])).toBe('mcp-sandbox/evil-pkg:pinned')
    expect(img('npm', ['x', '--yes', '@acme/srv'])).toBe('mcp-sandbox/acme-srv:pinned')
    expect(img('bun', ['x', 'evil-pkg@2.0.1'])).toBe('mcp-sandbox/evil-pkg:2.0.1')
    expect(img('pnpm', ['dlx', 'evil-pkg'])).toBe('mcp-sandbox/evil-pkg:pinned')
    expect(img('npm', ['exec', '--package=evil-pkg@1.2.3', '--', 'evil'])).toBe('mcp-sandbox/evil-pkg:1.2.3')
  })
  it('the re-scan of the hardened config no longer flags MCPS-SC-001', () => {
    const fixed = remediate({ mcpServers: { s: { command: 'npm', args: ['exec', '-y', 'evil-pkg'] } } })
    expect(scanConfig(fixed).findings.filter(f => f.ruleId === 'MCPS-SC-001')).toHaveLength(0)
  })
})
