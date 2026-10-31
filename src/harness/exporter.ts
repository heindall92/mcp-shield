import type { Severity } from '../types/mcp.types'
import type { Lang } from '../i18n/lang'
import type { HarnessResult } from './types'
import { pick } from '../i18n/lang'
import { HS_RULES, isoLabel } from './rules'
import { SARIF_SCHEMA, mdEscape } from '../engine/sarifExporter'
import { gate } from '../engine/exportGate'
import { redactString, safeText } from '../engine/redact'
import type { Gated } from '../integrity/evidence/integrityExporter'
import { VERSION } from '../meta'

/**
 * Harness-Shield reports. Same SARIF 2.1.0 schema, Markdown escaping, redaction and final output gate as the
 * Auditor and Integrity exports. Snippets are already redacted and capped at 140 characters by the scanner.
 */
const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { critical: 'error', high: 'error', medium: 'warning', low: 'note' }
const SCORE: Record<Severity, string> = { critical: '9.5', high: '7.5', medium: '5.0', low: '2.0' }
const RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 }
const RULES_URI = 'https://github.com/heindall92/mcp-shield#harness-shield'
const s = (x: string) => safeText(redactString(x))
const out = (text: string): Gated => { const g = gate(text); return { ok: g.ok, text: g.ok ? text : '', gate: g } }
/** Relative, URI-safe artifact path: no scheme, no leading slash, no "..", only [\w.-/]. */
export const artifactUri = (name: string) => name.replace(/\\/g, '/').split('/').filter(p => p && p !== '..' && p !== '.').map(p => p.replace(/[^\w.-]+/g, '_')).join('/') || 'file.txt'
const mdCode = (x: string) => '`' + x.replace(/`/g, "'").replace(/</g, '‹').replace(/>/g, '›').replace(/\r?\n/g, ' ') + '`'

export function harnessSarif(res: HarnessResult, lang: Lang) {
  const ids = HS_RULES.map(r => r.id).filter(id => res.findings.some(f => f.ruleId === id))
  return {
    $schema: SARIF_SCHEMA, version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'MCP-Shield', version: VERSION, semanticVersion: VERSION, informationUri: 'https://github.com/heindall92/mcp-shield',
        rules: ids.map(id => {
          const r = HS_RULES.find(x => x.id === id)!
          const worst = res.findings.filter(f => f.ruleId === id).reduce((w, f) => (RANK[f.severity] > RANK[w] ? f.severity : w), 'low' as Severity)
          const name = r.name[lang]
          return { id, name, shortDescription: { text: name }, fullDescription: { text: `${name} · OWASP ${r.owasp} ${r.owaspName[lang]} · ISO/IEC 42001 ${r.iso.join(', ')} (${pick(lang, 'mapeo orientativo', 'orientative mapping')})` },
            helpUri: RULES_URI, help: { text: pick(lang, `${name}. La corrección concreta va en cada resultado. Reglas: ${RULES_URI}`, `${name}. The specific fix is in each result. Rules: ${RULES_URI}`) },
            properties: { tags: ['security', 'agent-harness', r.owasp, ...r.iso.map(i => `ISO42001-${i}`), ...(r.cwe ? [r.cwe] : [])], 'security-severity': SCORE[worst], owasp: r.owasp, iso42001: r.iso } }
        }) } },
      automationDetails: { id: 'mcp-shield/harness/' },
      invocations: [{ executionSuccessful: true }],
      results: res.findings.map(f => ({
        ruleId: f.ruleId, ruleIndex: ids.indexOf(f.ruleId), level: LEVEL[f.severity],
        message: { text: s(`${f.title} — ${f.remediation}`) },
        locations: [{ physicalLocation: { artifactLocation: { uri: artifactUri(f.file) }, region: { startLine: Math.max(1, f.line), snippet: { text: s(f.snippet) } } } }],
        properties: { severity: f.severity, confidence: f.confidence, owasp: f.owasp, iso42001: f.iso, ...(f.hidden ? { decodedHidden: s(f.hidden) } : {}) },
      })),
      properties: { riskScore: res.riskScore, grade: res.grade, language: lang, mapping: 'orientative', files: res.files.map(x => ({ uri: artifactUri(x.name), kind: x.kind, lines: x.lines, findings: x.findings })) },
    }],
  }
}

export const exportHarnessSarif = (res: HarnessResult, lang: Lang) => out(JSON.stringify(harnessSarif(res, lang), null, 2))

export function harnessMarkdown(res: HarnessResult, lang: Lang): string {
  const L = (es: string, en: string) => pick(lang, es, en)
  const m = (x: string) => mdEscape(s(x))
  const rows = [`# MCP-Shield · Harness-Shield`, '',
    `- **Risk Score:** ${res.riskScore}/100 (${L('nota', 'grade')} ${res.grade})`,
    `- **${L('Archivos analizados', 'Files analysed')}:** ${res.files.length} · ${res.files.map(f => mdCode(s(f.name))).join(', ')}`,
    `- **${L('Hallazgos', 'Findings')}:** ${res.findings.length} (crit ${res.counts.critical} · high ${res.counts.high} · med ${res.counts.medium} · low ${res.counts.low})`,
    `- ${L('Análisis estático en el navegador: no se ejecutó nada y no hubo conexiones de red.', 'Static analysis in the browser: nothing was executed and no network connection was made.')}`,
    `- ${L('Mapeo OWASP Top 10 for LLM 2025 e ISO/IEC 42001 Anexo A orientativo, no oficial.', 'OWASP Top 10 for LLM 2025 and ISO/IEC 42001 Annex A mapping is orientative, not official.')}`, '',
    `| Sev | ${L('Confianza', 'Confidence')} | ${L('Regla', 'Rule')} | ${L('Archivo', 'File')} | ${L('Hallazgo', 'Finding')} | OWASP | ISO/IEC 42001 |`, '|---|---|---|---|---|---|---|',
    ...res.findings.map(f => `| ${f.severity.toUpperCase()} | ${f.confidence} | ${f.ruleId} | ${m(f.file)}:${f.line} | ${m(f.title)} | ${f.owasp} | ${f.iso.join(', ')} |`), '']
  res.findings.forEach(f => rows.push(`## ${f.ruleId} · ${m(f.title)}`, '',
    `- ${L('Ubicación', 'Location')}: ${mdCode(s(f.file))}:${f.line} · ${L('confianza', 'confidence')} ${f.confidence}`,
    `- ${L('Fragmento', 'Snippet')}: ${mdCode(s(f.snippet))}`,
    ...(f.hidden ? [`- ${L('Texto oculto decodificado', 'Decoded hidden text')}: ${mdCode(s(f.hidden))}`] : []),
    `- ${m(f.detail)}`,
    `- **${L('Remediación', 'Remediation')}:** ${m(f.remediation)}`,
    `- OWASP ${f.owasp} · ISO/IEC 42001 ${f.iso.map(i => isoLabel(i, lang)).join('; ')}${f.cwe ? ` · ${f.cwe}` : ''}`, ''))
  return rows.join('\n')
}

export const exportHarnessMarkdown = (res: HarnessResult, lang: Lang) => out(harnessMarkdown(res, lang))
