/** v1.4.0: SARIF rules describe the rule, not the first finding (GitHub code scanning and CTEM-Nexus read them as rule metadata). */
import { describe, it, expect } from 'vitest'
import { scanConfig, ALL_RULES } from '../src/engine/scanner'
import { toSarif } from '../src/engine/sarifExporter'
import { sampleConfigs } from '../src/data/sampleConfigs'

const res = scanConfig(sampleConfigs.find(s => s.id === 'dev-laptop')!.config)
const run = toSarif(res).runs[0]
const rule = (id: string) => run.tool.driver.rules.find(r => r.id === id)!
const NAMES = new Map(ALL_RULES.flatMap(r => [[r.id, r.name.es] as const, ...(r.emits ?? []).map(e => [e.id, e.name.es] as const)]))

describe('SARIF rule metadata', () => {
  it('every rule is named and described by its own definition', () => {
    for (const r of run.tool.driver.rules) { expect(r.name).toBe(NAMES.get(r.id)); expect(r.shortDescription.text).toBe(NAMES.get(r.id)) }
  })
  it('emitted rules (MCPS-SC-002) keep their own name, not the parent rule name', () => {
    expect(rule('MCPS-SC-002').name).toBe('Publisher npm sin scope verificable')
  })
  it('the rule text does not carry one server or package', () => {
    const findings = res.findings.filter(f => f.ruleId === 'MCPS-SC-001')
    expect(new Set(findings.map(f => f.server)).size).toBeGreaterThan(1)
    const { shortDescription, help, name } = rule('MCPS-SC-001'); const txt = JSON.stringify({ shortDescription, help, name }) // fullDescription is the rule's own prose (it cites the postmark-mcp incident)
    const pkgs = findings.map(f => /"([^"]+)"/.exec(f.title)![1])
    expect(new Set(pkgs).size).toBeGreaterThan(1)
    for (const p of pkgs) expect(txt).not.toContain(p)
  })
  it('security-severity is the worst severity seen for that rule', () => {
    const cfg = { mcpServers: { b: { command: 'npx', args: ['evil-b'] }, a: { command: 'npx', args: ['-y', 'evil-a'] } } } // the medium one comes first
    const sarif = toSarif(scanConfig(cfg)).runs[0]
    expect(scanConfig(cfg).findings.filter(f => f.ruleId === 'MCPS-SC-001').map(f => f.severity).sort()).toEqual(['high', 'medium'])
    expect(sarif.tool.driver.rules.find(r => r.id === 'MCPS-SC-001')!.properties['security-severity']).toBe('7.5')
  })
  it('each result keeps the specific server and title in its message', () => {
    for (const r of run.results) expect(r.message.text).toMatch(/^\[[^\]]+\] /)
  })
})

import { GRADE_BANDS, bandOf } from '../src/engine/grades'
describe('grade bands shared by the scanner and the risk meter', () => {
  it('thresholds A < 10 ≤ B < 35 ≤ C < 60 ≤ D < 80 ≤ F', () => {
    expect([0, 9, 10, 34, 35, 59, 60, 79, 80, 100].map(s => bandOf(s).g).join('')).toBe('AABBCCDDFF')
    expect(GRADE_BANDS.reduce((n, b) => n + b.to - b.from, 0)).toBe(100)
  })
  it('the scanner grade is the band letter of its score', () => {
    for (const s of sampleConfigs) { const r = scanConfig(s.config); if (r.grade !== 'N/A') expect(r.grade).toBe(bandOf(r.riskScore).g) }
  })
})
