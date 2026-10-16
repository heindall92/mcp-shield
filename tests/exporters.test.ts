import { describe, it, expect } from 'vitest'
import { scanConfig } from '../src/engine/scanner'
import { toSarif, toMarkdown } from '../src/engine/sarifExporter'
import { remediate, removedServers, dockerSnippet } from '../src/engine/remediator'
import { lineDiff } from '../src/engine/diff'
import { stepsFor } from '../src/engine/simulation'
import { sampleConfigs } from '../src/data/sampleConfigs'
import { attackScenarios } from '../src/data/attackScenarios'

const cfg = sampleConfigs[0].config
const res = scanConfig(cfg)

describe('SARIF 2.1.0', () => {
  const s = toSarif(res)
  it('estructura válida', () => {
    expect(s.version).toBe('2.1.0'); expect(s.$schema).toMatch(/sarif-schema-2\.1\.0/)
    expect(s.runs[0].tool.driver.name).toBe('MCP-Shield')
    expect(s.runs[0].results).toHaveLength(res.findings.length)
  })
  it('todo result referencia una regla declarada', () => {
    const rules = new Set(s.runs[0].tool.driver.rules.map(r => r.id))
    s.runs[0].results.forEach(r => expect(rules.has(r.ruleId)).toBe(true))
  })
  it('niveles y security-severity para GitHub code scanning', () => {
    s.runs[0].results.forEach(r => expect(['error', 'warning', 'note']).toContain(r.level))
    s.runs[0].tool.driver.rules.forEach(r => expect(Number(r.properties['security-severity'])).toBeGreaterThan(0))
  })
  it('no filtra el secreto completo', () => expect(JSON.stringify(s)).not.toContain('0000000000000000000000000000demo'))
})

describe('Markdown', () => {
  const md = toMarkdown(res)
  it('incluye score, tabla y gobernanza', () => {
    expect(md).toMatch(/^# Informe MCP-Shield/); expect(md).toContain(`${res.riskScore}/100`)
    expect(md).toContain('| Sev | Servidor |'); expect(md).toContain('ASI04')
  })
  it('una sección por hallazgo', () => expect(md.match(/^## MCPS-/gm)?.length).toBe(res.findings.length))
})

describe('remediador', () => {
  it('la config endurecida no tiene hallazgos critical/high', () => {
    const r = scanConfig(remediate(cfg))
    expect(r.findings.filter(f => ['critical', 'high'].includes(f.severity))).toEqual([])
  })
  it('usa docker --network none --read-only y refs de secretos', () => {
    const h = remediate(cfg).mcpServers.github
    expect(h.command).toBe('docker'); expect(h.args).toEqual(expect.arrayContaining(['--network', 'none', '--read-only', '--cap-drop', 'ALL']))
    expect(h.env?.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('${GITHUB_PERSONAL_ACCESS_TOKEN}')
  })
  it('elimina servidores envenenados', () => expect(removedServers(sampleConfigs[1].config)).toContain('math-helper'))
  it('git parcheado ≥ 2025.12.18', () => expect(JSON.stringify(remediate(cfg))).toContain('mcp-sandbox/mcp-server-git:2025.12.18'))
  it('remotos pasan a https', () => expect(remediate(sampleConfigs.find(s => s.id === 'shadowing')!.config).mcpServers.crm.url).toMatch(/^https:/))
  it('Dockerfile sin red y no root', () => { const d = dockerSnippet(cfg); expect(d).toContain('network_mode: "none"'); expect(d).toContain('USER mcp') })
})

describe('diff y simulación', () => {
  it('lineDiff marca add/del', () => {
    const d = lineDiff('a\nb\nc', 'a\nX\nc')
    expect(d.filter(l => l.type === 'del').map(l => l.text)).toEqual(['b']); expect(d.filter(l => l.type === 'add').map(l => l.text)).toEqual(['X'])
  })
  it('modo hardened bloquea antes del primer paso malicioso', () => attackScenarios.forEach(s => {
    const st = stepsFor(s, 'hardened')
    expect(st.some(x => x.blocked)).toBe(true); expect(st.some(x => x.highlight)).toBe(false)
  }))
  it('kill-chain completa en < 5 s', () => attackScenarios.forEach(s => expect(120 + (s.steps.length - 1) * 430).toBeLessThan(5000)))
})
