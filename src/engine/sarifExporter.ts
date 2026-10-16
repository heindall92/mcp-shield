import type { ScanResult, Severity } from '../types/mcp.types'
import { ALL_RULES } from './scanner'
import { CONTROL_MAP } from './governance'

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { critical: 'error', high: 'error', medium: 'warning', low: 'note' }
const SCORE: Record<Severity, string> = { critical: '9.5', high: '7.5', medium: '5.0', low: '2.0' }

export function toSarif(res: ScanResult, fileName = 'mcp.json') {
  const ruleIds = Array.from(new Set(res.findings.map(f => f.ruleId)))
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: {
        name: 'MCP-Shield', version: '1.0.0', informationUri: 'https://github.com/heindall92/mcp-shield',
        rules: ruleIds.map(id => {
          const f = res.findings.find(x => x.ruleId === id)!
          const r = ALL_RULES.find(x => f.ruleId.startsWith(x.id.slice(0, 8)))
          return { id, name: r?.name ?? f.category, shortDescription: { text: f.title }, fullDescription: { text: f.detail },
            help: { text: f.remediation }, properties: { tags: ['security', 'mcp', f.category, ...(f.cwe ? [f.cwe] : [])], 'security-severity': SCORE[f.severity] } }
        }),
      } },
      results: res.findings.map(f => ({
        ruleId: f.ruleId, level: LEVEL[f.severity],
        message: { text: `[${f.server}] ${f.title} — ${f.remediation}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: fileName }, region: { startLine: 1 } }, logicalLocations: [{ fullyQualifiedName: f.location }] }],
        properties: { severity: f.severity, evidence: f.evidence },
      })),
      properties: { riskScore: res.riskScore, grade: res.grade },
    }],
  }
}

export function toMarkdown(res: ScanResult): string {
  const lines = [`# Informe MCP-Shield`, '', `- **Risk Score:** ${res.riskScore}/100 (nota ${res.grade})`, `- **Servidores analizados:** ${res.serversScanned}`,
    `- **Hallazgos:** ${res.findings.length} (crit ${res.counts.critical} · high ${res.counts.high} · med ${res.counts.medium} · low ${res.counts.low})`,
    `- Generado 100% en el navegador — ningún dato salió del equipo.`, '', '| Sev | Servidor | Regla | Hallazgo | CWE |', '|---|---|---|---|---|',
    ...res.findings.map(f => `| ${f.severity.toUpperCase()} | ${f.server} | ${f.ruleId} | ${f.title.replace(/\|/g, '\\|')} | ${f.cwe ?? ''} |`), '']
  res.findings.forEach(f => lines.push(`## ${f.ruleId} · ${f.title}`, '', f.detail, '', `- Ubicación: \`${f.location}\``, `- Evidencia: \`${f.evidence.replace(/`/g, "'")}\``, `- **Remediación:** ${f.remediation}`, `- Gobernanza: ${CONTROL_MAP[f.category].owasp} · NSA: ${CONTROL_MAP[f.category].nsa} · ISO/IEC 42001 ${CONTROL_MAP[f.category].iso}`, ''))
  return lines.join('\n')
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
