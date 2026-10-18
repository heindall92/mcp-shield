/** v1.6.0: «yrd-ecosistema» envelope for CTEM-Nexus. The schema is CTEM-Nexus's own (tests/fixtures). */
import { describe, it, expect } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from './fixtures/yrd-ecosistema.schema.json'
import { scanText } from '../src/engine/scanner'
import { toEcosystem, ECO_FORMAT, ECO_TOOL } from '../src/engine/ecosystemExporter'
import { gate } from '../src/engine/exportGate'
import { sampleConfigs } from '../src/data/sampleConfigs'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const TOKEN = 'ghp_FAKEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const CFG = `{"mcpServers":{"github":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_TOKEN":"${TOKEN}"}},"fs":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/"]}}}`
const NOW = new Date('2026-10-18T09:30:00.123Z')
const env = (text = CFG, name = 'claude_desktop_config.json') => toEcosystem(scanText(text), name, 'es', text, NOW)

describe('yrd-ecosistema envelope', () => {
  it('has the shared header and type «hallazgos»', () => {
    const e = env()
    expect(e.format).toBe(ECO_FORMAT)
    expect(e.version).toBe(1)
    expect(e.origen).toEqual({ herramienta: ECO_TOOL, version: expect.stringMatching(/^\d+\.\d+\.\d+$/), generado: '2026-10-18T09:30:00Z' })
    expect(e.tipo).toBe('hallazgos')
    expect(e.proyecto).toBe('claude_desktop_config.json')
  })
  it('carries one item per finding, with the scan summary', () => {
    const res = scanText(CFG)
    const e = env()
    expect(e.datos).toHaveLength(res.findings.length)
    expect(e.datos.map(d => d.ruleId)).toEqual(res.findings.map(f => f.ruleId))
    expect(e.resumen).toMatchObject({ riesgo: res.riskScore, nota: res.grade, completo: true, servidores: 2, recuento: res.counts, idioma: 'es' })
    expect(e.datos.every(d => d.line >= 1)).toBe(true)
  })
  it('validates against the CTEM-Nexus schema, for every demo configuration too', () => {
    expect(validate(env()), JSON.stringify(validate.errors)).toBe(true)
    for (const s of sampleConfigs) {
      const text = JSON.stringify(s.config)
      expect(validate(toEcosystem(scanText(text), `${s.id}.json`, 'en', text, NOW)), `${s.id}: ${JSON.stringify(validate.errors)}`).toBe(true)
    }
  })
  it('the schema rejects an item with an unknown rule or severity', () => {
    const e = env()
    expect(validate({ ...e, datos: [{ ...e.datos[0], ruleId: 'XSS-1' }] })).toBe(false)
    expect(validate({ ...e, datos: [{ ...e.datos[0], severity: 'grave' }] })).toBe(false)
    const { resumen: _drop, ...sinResumen } = e
    expect(validate(sinResumen)).toBe(false)
  })
  it('never carries a secret and passes the export gate', () => {
    const txt = JSON.stringify(env())
    expect(txt).not.toContain(TOKEN)
    expect(gate(txt).ok).toBe(true)
  })
  it('the file name loses its path and control characters', () => {
    expect(env(CFG, 'C:\\Users\\ana\\AppData\\Roaming\\Claude\\claude_desktop_config.json').proyecto).toBe('claude_desktop_config.json')
    expect(env(CFG, '/home/ana/.cursor/mcp\u0007.json').proyecto).toBe('mcp.json')
    expect(env(CFG, '').proyecto).toBe('mcp.json')
  })
  it('a server called "__proto__" travels as data, without polluting objects', () => {
    const text = `{"mcpServers":{"__proto__":{"command":"npx","args":["-y","evil-pkg","/"]}}}`
    const e = toEcosystem(scanText(text), 'mcp.json', 'en', text, NOW)
    expect(e.datos.some(d => d.server === '__proto__')).toBe(true)
    expect(validate(JSON.parse(JSON.stringify(e)))).toBe(true)
    expect(({} as Record<string, unknown>).command).toBeUndefined()
  })
  it('an unreadable file gives an empty, honest envelope (grade N/A, incomplete)', () => {
    const e = toEcosystem(scanText('{ not json'), 'mcp.json', 'es', '{ not json', NOW)
    expect(e.datos).toEqual([])
    expect(e.resumen).toMatchObject({ nota: 'N/A', completo: false })
    expect(validate(e)).toBe(true)
  })
})

/** Published sample: the same file CTEM-Nexus tests (shared/samples/ecosistema). UPDATE_SAMPLE=1 regenerates it. */
describe('published sample docs/ecosistema/mcp-shield-hallazgos-ejemplo.json', () => {
  it('is exactly what the exporter produces today', async () => {
    const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs')
    const pick = ['dev-laptop', 'poisoned', 'shadowing']
    const servers = Object.assign({}, ...sampleConfigs.filter(s => pick.includes(s.id)).map(s => s.config.mcpServers))
    const text = JSON.stringify({ mcpServers: servers }, null, 2)
    const out = JSON.stringify(toEcosystem(scanText(text), 'claude_desktop_config.json', 'es', text, NOW), null, 2) + '\n'
    const path = 'docs/ecosistema/mcp-shield-hallazgos-ejemplo.json'
    if (process.env.UPDATE_SAMPLE) { mkdirSync('docs/ecosistema', { recursive: true }); writeFileSync(path, out) }
    expect(readFileSync(path, 'utf8')).toBe(out)
    const e = JSON.parse(out)
    expect(new Set(e.datos.map((d: { category: string }) => d.category))).toEqual(new Set(['supply-chain', 'filesystem', 'secrets', 'tool-poisoning']))
  })
})
