import type { ScanResult, Severity } from '../types/mcp.types'
import type { Lang } from '../i18n/lang'
import { pick } from '../i18n/lang'
import { ALL_RULES } from './scanner'
import { controlMap } from './governance'
import { redactString } from './redact'
import { VERSION } from '../meta'

export const SARIF_SCHEMA = 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json'

/** Best-effort 1-based line of a finding's JSON path inside the original text (e.g. mcpServers.github.env.TOKEN). */
export function lineFor(text: string | undefined, location: string): number {
  if (!text) return 1
  const parts = location.replace(/\[(\d+)\]/g, '').split('.').slice(1) // drop "mcpServers"
  let pos = 0
  for (const part of parts) {
    const i = text.indexOf(`"${part}"`, pos)
    if (i < 0) break
    pos = i
  }
  return text.slice(0, pos).split('\n').length
}

/** Escape text for Markdown tables/inline code and neutralise raw HTML. */
export const mdEscape = (s: string) => s.replace(/[\\`*_[\]|<>]/g, c => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '\\' + c)).replace(/\r?\n/g, ' ')
const mdCode = (s: string) => '`' + s.replace(/`/g, "'").replace(/</g, '‹').replace(/>/g, '›').replace(/\r?\n/g, ' ') + '`'

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { critical: 'error', high: 'error', medium: 'warning', low: 'note' }
const SCORE: Record<Severity, string> = { critical: '9.5', high: '7.5', medium: '5.0', low: '2.0' }
const RULES_URI = 'https://github.com/heindall92/mcp-shield#reglas'
const RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 }
/** Names of every rule id a scan can emit, including the ids a rule emits on behalf of another (MCPS-SC-002). */
const RULE_NAMES = new Map(ALL_RULES.flatMap(r => [[r.id, r.name] as const, ...(r.emits ?? []).map(e => [e.id, e.name] as const)]))

export function toSarif(res: ScanResult, fileName = 'mcp.json', lang: Lang = 'es', sourceText?: string) {
  const ruleIds = Array.from(new Set(res.findings.map(f => f.ruleId)))
  const uri = (fileName.replace(/[^\w.-]+/g, '_') || 'mcp.json')
  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [{
      tool: { driver: {
        name: 'MCP-Shield', version: VERSION, semanticVersion: VERSION, informationUri: 'https://github.com/heindall92/mcp-shield',
        // Rule metadata describes the rule (GitHub code scanning and CTEM-Nexus read it as such); the specific
        // server, package and fix live in each result's message. Severity is the worst one seen for the rule.
        rules: ruleIds.map(id => {
          const all = res.findings.filter(x => x.ruleId === id)
          const f = all.reduce((w, x) => (RANK[x.severity] > RANK[w.severity] ? x : w))
          const name = RULE_NAMES.get(id)?.[lang] ?? f.category
          return { id, name, shortDescription: { text: name }, fullDescription: { text: redactString(f.detail) },
            helpUri: RULES_URI, help: { text: pick(lang, `${name}. La corrección concreta de cada caso está en el mensaje del resultado. Reglas: ${RULES_URI}`, `${name}. The specific fix for each case is in the result message. Rules: ${RULES_URI}`) }, properties: { tags: ['security', 'mcp', f.category, ...(f.cwe ? [f.cwe] : [])], 'security-severity': SCORE[f.severity] } }
        }),
      } },
      invocations: [{
        executionSuccessful: res.complete,
        toolExecutionNotifications: res.coverage.filter(c => c.status === 'ERROR' || c.status === 'NOT_EVALUATED').map(c => ({
          level: c.status === 'ERROR' ? 'error' : 'note',
          descriptor: { id: c.ruleId },
          message: { text: `${c.ruleId} ${c.status}${c.diagnostic ? `: ${c.diagnostic}` : ''}` },
          properties: { status: c.status },
        })),
        ...(res.parseError ? { toolConfigurationNotifications: [{ level: 'error', message: { text: redactString(res.parseError) } }] } : {}),
      }],
      results: res.findings.map(f => ({
        ruleId: f.ruleId, ruleIndex: ruleIds.indexOf(f.ruleId), level: LEVEL[f.severity],
        message: { text: redactString(`[${f.server}] ${f.title} — ${f.remediation}`) },
        locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: lineFor(sourceText, f.location) } }, logicalLocations: [{ fullyQualifiedName: f.location }] }],
        properties: { severity: f.severity, evidence: redactString(f.evidence) },
      })),
      properties: { riskScore: res.riskScore, grade: res.grade, complete: res.complete, language: lang, surfaces: res.surfaces,
        ruleCoverage: res.coverage.map(c => ({ ruleId: c.ruleId, status: c.status, surface: c.surface, ...(c.diagnostic ? { diagnostic: c.diagnostic } : {}) })) },
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
    `- **${L('Superficies analizadas', 'Surfaces analysed')}:** ${L('configuración', 'configuration')}${res.surfaces.tools ? ` + ${L('inventario de herramientas', 'tool inventory')} (${res.surfaces.tools} tools, ${res.surfaces.toolServers} ${L('servidores', 'servers')})` : ` · ${L('sin inventario de herramientas (las reglas de Tool Poisoning no se evaluaron)', 'no tool inventory (Tool Poisoning rules not evaluated)')}`}`,
    ...(res.complete ? [] : [`- **${L('Análisis incompleto', 'Incomplete analysis')}:** ${L('una o más reglas no pudieron ejecutarse; el resultado no es una garantía de limpieza.', 'one or more rules could not run; the result is not a clean bill of health.')}`]),
    `- ${L('Generado en el navegador, sin conexiones de red.', 'Generated in the browser, with no network connections.')}`, '',
    `| Sev | ${L('Servidor', 'Server')} | ${L('Regla', 'Rule')} | ${L('Hallazgo', 'Finding')} | CWE |`, '|---|---|---|---|---|',
    ...res.findings.map(f => `| ${f.severity.toUpperCase()} | ${mdEscape(f.server)} | ${f.ruleId} | ${mdEscape(redactString(f.title))} | ${f.cwe ?? ''} |`), '']
  lines.push(`## ${L('Cobertura de reglas', 'Rule coverage')}`, '', `| ${L('Regla', 'Rule')} | ${L('Estado', 'Status')} | ${L('Superficie', 'Surface')} | ${L('Diagnóstico', 'Diagnostic')} |`, '|---|---|---|---|',
    ...res.coverage.map(c => `| ${c.ruleId} | ${c.status} | ${c.surface} | ${mdEscape(c.diagnostic ?? '')} |`), '')
  res.findings.forEach(f => lines.push(`## ${f.ruleId} · ${mdEscape(redactString(f.title))}`, '', mdEscape(redactString(f.detail)), '',
    `- ${L('Ubicación', 'Location')}: ${mdCode(f.location)}`, `- ${L('Evidencia', 'Evidence')}: ${mdCode(redactString(f.evidence))}`,
    `- **${L('Remediación', 'Remediation')}:** ${mdEscape(redactString(f.remediation))}`,
    `- ${L('Gobernanza', 'Governance')}: ${cm[f.category].owasp} · NSA: ${cm[f.category].nsa} · ISO/IEC 42001 ${cm[f.category].iso}`, ''))
  return lines.join('\n')
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
