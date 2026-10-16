import { describe, it, expect } from 'vitest'
import { scanConfig, scanText } from '../src/engine/scanner'
import { toMarkdown, toSarif } from '../src/engine/sarifExporter'
import { dockerSnippet } from '../src/engine/remediator'
import { stepsFor } from '../src/engine/simulation'
import { attackScenarios, getScenarios } from '../src/data/attackScenarios'
import { scenariosEn } from '../src/data/attackScenarios.en'
import { sampleConfigs } from '../src/data/sampleConfigs'
import { getIncidents } from '../src/data/incidents'
import { controlMap } from '../src/engine/governance'
import { UI } from '../src/i18n/ui'

const SPANISH = /\b(sin|versión|herramienta|servidor|fichero|usuario|Corrección|Remediación|hallazgos?)\b/i

describe('ES/EN', () => {
  it('UI dictionaries have the same keys', () => expect(Object.keys(UI.en).sort()).toEqual(Object.keys(UI.es).sort()))
  it('findings are fully English in EN', () => {
    const all = sampleConfigs.flatMap(s => scanConfig(s.config, 'en').findings)
    expect(all.length).toBeGreaterThan(10)
    for (const f of all) for (const k of ['title', 'detail', 'remediation'] as const) expect(f[k]).not.toMatch(SPANISH)
  })
  it('same findings (ids/severity) in both languages', () => {
    const k = (l: 'es' | 'en') => scanConfig(sampleConfigs[0].config, l).findings.map(f => `${f.ruleId}:${f.severity}`)
    expect(k('en')).toEqual(k('es'))
  })
  it('parse error localised', () => expect(scanText('{"a":1}', 'en').parseError).toMatch(/Missing root key/))
  it('every scenario has an EN overlay with matching step count', () => attackScenarios.forEach(s => expect(scenariosEn[s.id].steps).toHaveLength(s.steps.length)))
  it('EN scenarios keep the same simulated payload markers', () => getScenarios('en').forEach((s, i) => s.steps.forEach((st, j) => {
    expect(st.content.includes('⟦')).toBe(attackScenarios[i].steps[j].content.includes('⟦'))
    expect(!!st.impact).toBe(!!attackScenarios[i].steps[j].impact)
  })))
  it('hardened steps localised', () => expect(stepsFor(getScenarios('en')[0], 'hardened', 'en').map(s => s.content).join(' ')).toMatch(/BLOCKED/))
  it('exports human text in EN', () => {
    const r = scanConfig(sampleConfigs[0].config, 'en')
    expect(toMarkdown(r, 'en')).toMatch(/^# MCP-Shield report/)
    expect(toMarkdown(r, 'en')).not.toMatch(/Remediación|Hallazgos/)
    expect(toSarif(r, 'mcp.json', 'en').runs[0].tool.driver.rules[0].name).not.toMatch(SPANISH)
    expect(dockerSnippet(sampleConfigs[0].config, 'en')).toMatch(/no egress/)
  })
  it('incidents and governance localised', () => {
    expect(getIncidents('en').map(i => i.fact).join(' ')).not.toMatch(SPANISH)
    expect(Object.values(controlMap('en')).map(c => c.nsa + c.iso).join(' ')).not.toMatch(/Gestión|Ciclo|Datos/)
  })
})
