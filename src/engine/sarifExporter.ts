import type { ScanResult, Severity } from '../types/mcp.types'
import type { Lang } from '../i18n/lang'
import { pick } from '../i18n/lang'
import { ALL_RULES } from './scanner'
import { controlMap } from './governance'

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { critical: 'error', high: 'error', medium: 'warning', low: 'note' }
const SCORE: Record<Severity, string> = { critical: '9.5', high: '7.5', medium: '5.0', low: '2.0' }

export function toSarif(res: ScanResult, fileName = 'mcp.json', lang: Lang = 'es') {
  const ruleIds = Array.from(new Set(res.findings.map(f => f.ruleId)))
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: {
        name: 'MCP-Shield', version: '1.0.0', informationUri: 'https://github.com/heindall92/mcp-shield',
        rules: ruleIds.map(id => {
          const f = res.findings.find(x => x.ruleId === id)!
          const r = ALL_RULES.find(x => x.category === f.category && f.ruleId.startsWith(x.id.slice(0, 8)))
          return { id, name: r ? r.name[lang] : f.category, shortDescription: { text: f.title }, fullDescription: { text: f.detail },
            help: { text: f.remediation }, properties: { tags: ['security', 'mcp', f.category, ...(f.cwe ? [f.cwe] : [])], 'security-severity': SCORE[f.severity] } }
        }),
      } },
      results: res.findings.map(f => ({
        ruleId: f.ruleId, level: LEVEL[f.severity],
        message: { text: `[${f.server}] ${f.title} — ${f.remediation}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: fileName }, region: { startLine: 1 } }, logicalLocations: [{ fullyQualifiedName: f.location }] }],
        properties: { severity: f.severity, evidence: f.evidence },
      })),
      properties: { riskScore: res.riskScore, grade: res.grade, language: lang },
    }],
  }
}

export function toMarkdown(res: ScanResult, lang: Lang = 'es'): string {
  const L = (es: string, en: string) => pick(lang, es, en)
  const cm = controlMap(lang)
  const lines = [L('# Informe MCP-Shield', '# MCP-Shield report'), '',
    `- **Risk Score:** ${res.riskScore}/100 (${L('nota', 'grade')} ${res.grade})`,
    `- **${L('Servidores analizados', 'Servers scanned')}:** ${res.serversScanned}`,
    `- **${L('Hallazgos', 'Findings')}:** ${res.findings.length} (crit ${res.counts.critical} · high ${res.counts.high} · med ${res.counts.medium} · low ${res.counts.low})`,
    `- ${L('Generado 100% en el navegador: ningún dato salió del equipo.', 'Generated 100% in the browser: no data left the device.')}`, '',
    `| Sev | ${L('Servidor', 'Server')} | ${L('Regla', 'Rule')} | ${L('Hallazgo', 'Finding')} | CWE |`, '|---|---|---|---|---|',
    ...res.findings.map(f => `| ${f.severity.toUpperCase()} | ${f.server} | ${f.ruleId} | ${f.title.replace(/\|/g, '\\|')} | ${f.cwe ?? ''} |`), '']
  res.findings.forEach(f => lines.push(`## ${f.ruleId} · ${f.title}`, '', f.detail, '',
    `- ${L('Ubicación', 'Location')}: \`${f.location}\``, `- ${L('Evidencia', 'Evidence')}: \`${f.evidence.replace(/`/g, "'")}\``,
    `- **${L('Remediación', 'Remediation')}:** ${f.remediation}`,
    `- ${L('Gobernanza', 'Governance')}: ${cm[f.category].owasp} · NSA: ${cm[f.category].nsa} · ISO/IEC 42001 ${cm[f.category].iso}`, ''))
  return lines.join('\n')
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
