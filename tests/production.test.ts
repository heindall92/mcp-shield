import { describe, it, expect } from 'vitest'
import Ajv from 'ajv-draft-04'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import { parseMcp, MAX_INPUT_BYTES } from '../src/engine/parse'
import { scanText, scanConfig } from '../src/engine/scanner'
import { remediate, dockerSnippet } from '../src/engine/remediator'
import { toSarif, toMarkdown, lineFor, SARIF_SCHEMA } from '../src/engine/sarifExporter'
import { redactString, redactValue, isRef } from '../src/engine/redact'
import { clearAppStorage } from '../src/i18n/storage'
import { sampleConfigs } from '../src/data/sampleConfigs'
import type { McpConfig } from '../src/types/mcp.types'

// Realistic-looking but obviously fake credentials (never real).
const GH = 'ghp_FAKE' + 'a'.repeat(32)
const SK = 'sk-FAKE-' + 'b'.repeat(32)
const ids = (c: McpConfig) => scanConfig(c).findings.map(f => `${f.ruleId}:${f.severity}`)

describe('parser', () => {
  it('Claude Desktop mcpServers', () => expect(Object.keys(parseMcp('{"mcpServers":{"a":{"command":"npx","args":["x"]}}}').config!.mcpServers)).toEqual(['a']))
  it('VS Code "servers" + inputs', () => {
    const r = parseMcp('{"inputs":[{"type":"promptString","id":"tok","password":true}],"servers":{"gh":{"type":"http","url":"https://api.githubcopilot.com/mcp/","headers":{"Authorization":"Bearer ${input:tok}"}}}}')
    expect(r.config!.mcpServers.gh.url).toMatch(/^https/); expect(r.config!.mcpServers.gh.headers!.Authorization).toContain('${input:tok}')
  })
  it('settings.json "mcp.servers"', () => expect(parseMcp('{"mcp":{"servers":{"z":{"command":"uvx","args":["mcp-server-fetch"]}}}}').config!.mcpServers.z.command).toBe('uvx'))
  it('JSONC: comments and trailing commas, strings untouched', () => {
    const r = parseMcp('// cfg\n{ /* x */ "mcpServers": { "a": { "command": "npx", "args": ["https://x.dev/a//b", "/* keep */",], }, }, }')
    expect(r.config!.mcpServers.a.args).toEqual(['https://x.dev/a//b', '/* keep */'])
  })
  it('BOM', () => expect(parseMcp('\uFEFF{"mcpServers":{}}').error).toBeUndefined())
  it('empty, whitespace', () => { expect(parseMcp('').error).toBeTruthy(); expect(parseMcp('   \n').error).toBeTruthy() })
  it('malformed reports a line, ES and EN', () => {
    expect(parseMcp('{\n"mcpServers": {\n  "a": }\n}', 'es').error).toMatch(/línea|JSON/i)
    expect(parseMcp('{\n"mcpServers": {\n  "a": }\n}', 'en').error).toMatch(/line|JSON/i)
  })
  it('non-object inputs never throw', () => { for (const t of ['[]', '42', '"x"', 'null', 'true', '{"mcpServers":[]}', '{"mcpServers":{"a":null}}', '{"mcpServers":{"a":"npx"}}']) expect(() => parseMcp(t)).not.toThrow() })
  it('size limit', () => expect(parseMcp('{"a":"' + 'x'.repeat(MAX_INPUT_BYTES + 10) + '"}').error).toMatch(/1 MB/))
  it('coerces odd field types', () => { const r = parseMcp('{"mcpServers":{"a":{"command":"npx","args":["x",1,true],"env":{"N":5}}}}'); expect(r.config!.mcpServers.a.args).toEqual(['x', '1', 'true']); expect(r.warnings.length).toBeGreaterThanOrEqual(0) })
  it('scanText never throws on garbage', () => { for (const t of ['{', '}}}', '\u0000', '{"mcpServers":{"a":{"tools":[{"description":' + JSON.stringify('<IMPORTANT>'.repeat(5000)) + '}]}}}']) expect(() => scanText(t)).not.toThrow() })
})

describe('redaction: secrets never leave unredacted', () => {
  const text = JSON.stringify({ mcpServers: {
    gh: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: GH } },
    cli: { command: 'node', args: ['srv.js', '--api-key', SK, `--token=${GH}`] },
    remote: { type: 'http', url: `https://user:hunter2pass@mcp.example.com/mcp?token=${SK}`, headers: { Authorization: `Bearer ${SK}` } },
  } })
  const res = scanText(text, 'en')
  const cfg = parseMcp(text).config!
  const outputs = {
    findings: JSON.stringify(res.findings), sarif: JSON.stringify(toSarif(res, 'mcp.json', 'en', text)), md: toMarkdown(res, 'en'),
    fixed: JSON.stringify(remediate(cfg)), before: JSON.stringify(redactValue(cfg)), docker: dockerSnippet(cfg, 'en'),
  }
  for (const [k, v] of Object.entries(outputs)) it(`${k} contains no secret`, () => {
    for (const s of [GH, SK, 'hunter2pass', GH.slice(0, 20), SK.slice(8, 30)]) expect(v).not.toContain(s)
  })
  it('fixed config uses ${VAR} references', () => {
    const f = remediate(cfg).mcpServers
    expect(f.gh.env!.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('${GITHUB_PERSONAL_ACCESS_TOKEN}')
    expect(f.remote.headers!.Authorization).toMatch(/^Bearer \$\{[A-Z_]+\}$/)
    expect(f.cli.args!.join(' ')).toMatch(/\$\{CLI_API_KEY\}/)
    expect(f.cli.env).toBeTruthy()
  })
  it('redactString is idempotent and keeps refs', () => {
    const once = redactString(`TOKEN=${GH} Bearer ${SK}`); expect(redactString(once)).toBe(once)
    expect(redactString('API_KEY=${API_KEY}')).toBe('API_KEY=${API_KEY}')
  })
  it('isRef understands VS Code / Cursor syntax', () => { for (const r of ['${X}', '${env:X}', '${input:tok}', '$X']) expect(isRef(r)).toBe(true) })
  it('no input is ever written to storage by the engine', () => {
    const writes: string[] = []
    const g = globalThis as unknown as { localStorage?: unknown }
    const prev = g.localStorage
    g.localStorage = { setItem: (k: string) => writes.push(k), getItem: () => null, removeItem() {}, key: () => null, length: 0 }
    scanText(text); remediate(cfg); toSarif(res); toMarkdown(res)
    g.localStorage = prev
    expect(writes).toEqual([])
  })
})

describe('official-doc configs: no false positives', () => {
  it('GitHub official docker image with placeholder token', () => {
    const f = ids({ mcpServers: { github: { command: 'docker', args: ['run', '-i', '--rm', '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN', 'ghcr.io/github/github-mcp-server'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '<YOUR_TOKEN>' } } } })
    expect(f.filter(x => /SEC/.test(x))).toEqual([]); expect(f.every(x => x.endsWith(':low'))).toBe(true)
  })
  it('VS Code remote GitHub with ${input:} header', () => expect(ids({ mcpServers: { github: { type: 'http', url: 'https://api.githubcopilot.com/mcp/', headers: { Authorization: 'Bearer ${input:github_mcp_pat}' } } } })).toEqual([]))
  it('uvx fetch: PyPI has no scopes (no SC-002)', () => expect(ids({ mcpServers: { fetch: { command: 'uvx', args: ['mcp-server-fetch'] } } }).some(x => x.startsWith('MCPS-SC-002'))).toBe(false))
  it('uvx with @version pin is pinned', () => expect(ids({ mcpServers: { f: { command: 'uvx', args: ['mcp-server-fetch@2025.4.7'] } } }).some(x => x.startsWith('MCPS-SC-001'))).toBe(false))
  it('filesystem on project subdirs is not "whole home"', () => expect(ids({ mcpServers: { fs: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@2025.8.21', '/Users/username/Desktop', '/path/to/other/allowed/dir'] } } })).toEqual([]))
  it('URL and boolean values under secret-ish keys are not secrets', () => expect(ids({ mcpServers: { a: { command: 'npx', args: ['@x/y@1.0.0'], env: { AUTH_URL: 'https://login.example.com/oauth', TOKEN_CACHE: 'true', SECRET_PATH: './secrets' } } } })).toEqual([]))
  it('benign description mentioning "other tools" is not shadowing', () => expect(ids({ mcpServers: { a: { url: 'https://a.dev/mcp', tools: [{ name: 'list', description: 'Lists files. Works well together with other tools.' }] } } })).toEqual([]))
  it('lone "base64" in a description is only medium', () => expect(ids({ mcpServers: { a: { url: 'https://a.dev/mcp', tools: [{ name: 'enc', description: 'Encodes the given text as base64.' }] } } })).toEqual(['MCPS-TP-001:medium']))
  it('docker network-open alone is low', () => expect(ids({ mcpServers: { d: { command: 'docker', args: ['run', '-i', '--rm', 'img:1'] } } })).toEqual(['MCPS-FS-003:low']))
})

describe('false negatives fixed', () => {
  it('Windows cmd /c npx and npx.cmd', () => {
    expect(ids({ mcpServers: { a: { command: 'cmd', args: ['/c', 'npx', '-y', 'weather-mcp'] } } }).some(x => x.startsWith('MCPS-SC-001'))).toBe(true)
    expect(ids({ mcpServers: { a: { command: 'C:\\Program Files\\nodejs\\npx.cmd', args: ['-y', 'weather-mcp'] } } }).some(x => x.startsWith('MCPS-SC-001'))).toBe(true)
  })
  it('docker --mount src=/ and -v ~/.ssh', () => {
    expect(ids({ mcpServers: { a: { command: 'docker', args: ['run', '--mount', 'type=bind,src=/,dst=/host', 'img'] } } })).toContain('MCPS-FS-001:critical')
    expect(ids({ mcpServers: { a: { command: 'docker', args: ['run', '-v', '/home/me/.ssh:/k:ro', 'img'] } } })).toContain('MCPS-FS-001:critical')
  })
  it('FS-002 compares versions numerically', () => {
    const git = (v: string) => ids({ mcpServers: { g: { command: 'uvx', args: [`mcp-server-git==${v}`] } } }).some(x => x.startsWith('MCPS-FS-002'))
    expect(git('2025.9.25')).toBe(true); expect(git('2025.12.17')).toBe(true); expect(git('2025.12.18')).toBe(false); expect(git('2026.1.14')).toBe(false)
  })
  it('Authorization header and URL query token', () => {
    expect(ids({ mcpServers: { r: { url: 'https://x.dev/mcp', headers: { Authorization: `Bearer ${SK}` } } } })).toContain('MCPS-SEC-001:critical')
    expect(ids({ mcpServers: { r: { url: `https://x.dev/mcp?api_key=${SK}` } } })).toContain('MCPS-SEC-001:critical')
  })
})

describe('remediator', () => {
  it('does not double-wrap docker servers and strips escapes', () => {
    const f = remediate({ mcpServers: { d: { command: 'docker', args: ['run', '--privileged', '-v', '/var/run/docker.sock:/var/run/docker.sock', '--network', 'host', '-i', 'ghcr.io/x/y:1.2.3'] } } }).mcpServers.d
    expect(f.args!.filter(a => a === 'run')).toHaveLength(1)
    expect(f.args).toContain('ghcr.io/x/y:1.2.3'); expect(f.args!.join(' ')).not.toMatch(/privileged|docker\.sock|host/)
    expect(scanConfig({ mcpServers: { d: f } }).findings.filter(x => x.severity !== 'low')).toEqual([])
  })
  it('keeps remote type/headers', () => { const f = remediate({ mcpServers: { r: { type: 'http', url: 'http://x.dev/mcp', headers: { 'X-Team': 'blue' } } } }).mcpServers.r; expect(f).toMatchObject({ type: 'http', url: 'https://x.dev/mcp', headers: { 'X-Team': 'blue' } }) })
  it('python Dockerfile for uvx servers', () => { const d = dockerSnippet({ mcpServers: { g: { command: 'uvx', args: ['mcp-server-git'] } } }, 'en'); expect(d).toMatch(/FROM python/); expect(d).toContain('mcp-server-git==2025.12.18'); expect(d).not.toMatch(/npm install/) })
  it('hardened samples stay clean (except the deliberately unfixable docker-escape demo)', () => { for (const s of sampleConfigs.filter(x => x.id !== 'docker-escape')) expect(scanConfig(remediate(s.config)).findings.filter(f => f.severity === 'critical' || f.severity === 'high')).toEqual([]) })
})

describe('SARIF official schema', () => {
  const schema = JSON.parse(readFileSync(new URL('./fixtures/sarif-schema-2.1.0.json', import.meta.url), 'utf8'))
  const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv)
  const validate = ajv.compile(schema)
  for (const s of sampleConfigs) it(`valid for sample ${s.id} (es/en)`, () => {
    const text = JSON.stringify(s.config, null, 2)
    for (const lang of ['es', 'en'] as const) {
      const ok = validate(toSarif(scanText(text, lang), 'mcp.json', lang, text))
      expect(ok, JSON.stringify(validate.errors?.slice(0, 3))).toBe(true)
    }
  })
  it('uses the OASIS $schema and ruleIndex', () => {
    const r = toSarif(scanText(JSON.stringify(sampleConfigs[0].config)))
    expect(r.$schema).toBe(SARIF_SCHEMA); r.runs[0].results.forEach(x => expect(r.runs[0].tool.driver.rules[x.ruleIndex].id).toBe(x.ruleId))
  })
  it('line numbers point at the finding', () => { const t = '{\n "mcpServers": {\n  "a": {\n   "env": {\n    "TOKEN": "x"\n   }\n  }\n }\n}'; expect(lineFor(t, 'mcpServers.a.env.TOKEN')).toBe(5) })
})

describe('markdown injection', () => {
  it('escapes pipes, backticks and HTML from server names', () => {
    const md = toMarkdown(scanConfig({ mcpServers: { '<img src=x onerror=alert(1)>|`x`': { command: 'npx', args: ['-y', 'evil'] } } }))
    expect(md).not.toMatch(/<img/); expect(md).toContain('&lt;img'); expect(md).toContain('\\|')
  })
})

describe('reset', () => {
  it('clears app keys but keeps theme/lang', () => {
    const m = new Map([['mcps-lang', 'en'], ['mcps-theme', 'light'], ['mcps-draft', 'x'], ['other-app', 'y']])
    clearAppStorage({ get length() { return m.size }, key: (i: number) => [...m.keys()][i] ?? null, removeItem: (k: string) => { m.delete(k) } })
    expect([...m.keys()].sort()).toEqual(['mcps-lang', 'mcps-theme', 'other-app'])
  })
})
