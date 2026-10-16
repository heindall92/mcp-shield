import type { Analysis } from '../analysis'
import type { Lang } from '../../i18n/lang'
import type { Severity } from '../../types/mcp.types'
import type { DecisionRecord } from '../domain/types'
import { pick } from '../../i18n/lang'
import { INT_RULES } from '../rules/integrityRules'
import { gate, type GateResult } from '../../engine/exportGate'
import { redactString, safeText } from '../../engine/redact'
import { SARIF_SCHEMA, mdEscape } from '../../engine/sarifExporter'
import { VERSION } from '../../meta'

/**
 * Integrity evidence (RFC-001 §11). Exports carry metadata, events, public hashes and the root HMAC only:
 * never the HMAC key, never raw tool text beyond redacted, capped change previews. Every export passes gate().
 */
const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { critical: 'error', high: 'error', medium: 'warning', low: 'note' }
const SCORE: Record<Severity, string> = { critical: '9.5', high: '7.5', medium: '5.0', low: '2.0' }
const s = (x: string) => safeText(redactString(x))

export interface Gated { ok: boolean; text: string; gate: GateResult }
const out = (text: string): Gated => { const g = gate(text); return { ok: g.ok, text: g.ok ? text : '', gate: g } }

export function evidenceJson(a: Analysis, log: readonly DecisionRecord[]) {
  const meta = (x?: Analysis['candidate']) => x && { snapshotId: s(x.snapshotId), capturedAt: x.capturedAt, target: { ...x.target, profileId: s(x.target.profileId), serverLabel: s(x.target.serverLabel), authContextId: s(x.target.authContextId) }, provenance: x.provenance, capture: x.capture }
  return {
    format: 'mcp-shield-integrity-evidence', version: 1, tool: { name: 'MCP-Shield', version: VERSION },
    baseline: meta(a.baseline), candidate: meta(a.candidate),
    hashes: { params: a.cand.params, candidate: { publicRoot: a.cand.publicRoot, root: a.cand.root }, baseline: a.base && { publicRoot: a.base.publicRoot, root: a.base.root } },
    comparability: a.comparability, unconfirmedMissing: a.unconfirmedMissing.map(s),
    events: a.events.map(e => ({ ...e, tool: e.tool && s(e.tool), changes: e.changes.map(c => ({ path: s(c.path), before: c.before && s(c.before), after: c.after && s(c.after) })) })),
    integrityRisk: a.integrityRisk, configurationRisk: a.configRisk.riskScore,
    findings: a.findings.map(f => ({ ...f, tool: s(f.tool), title: s(f.title), detail: s(f.detail) })),
    configurationFindings: a.configRisk.findings.map(f => ({ ruleId: f.ruleId, severity: f.severity, title: s(f.title), location: s(f.location) })),
    coverage: a.coverage, decisions: log.map(d => ({ ...d, note: d.note && s(d.note) })),
  }
}

export const exportJson = (a: Analysis, log: readonly DecisionRecord[]) => out(JSON.stringify(evidenceJson(a, log), null, 2))

export function exportSarif(a: Analysis, lang: Lang) {
  const uri = `inventory/${(a.candidate.target.serverLabel || 'server').replace(/[^\w.-]+/g, '_')}.json`
  const all = [...a.findings.map(f => ({ ruleId: f.ruleId, severity: f.severity, text: `${s(f.title)}. ${s(f.detail)}`, tool: s(f.tool) })),
    ...a.configRisk.findings.map(f => ({ ruleId: f.ruleId, severity: f.severity, text: s(f.title), tool: '' }))]
  const ids = [...new Set(all.map(f => f.ruleId))]
  const sarif = { $schema: SARIF_SCHEMA, version: '2.1.0', runs: [{
    tool: { driver: { name: 'MCP-Shield', version: VERSION, semanticVersion: VERSION, informationUri: 'https://github.com/heindall92/mcp-shield',
      rules: ids.map(id => { const r = INT_RULES.find(x => x.id === id); return { id, name: id, shortDescription: { text: r ? pick(lang, r.name.es, r.name.en) : id }, properties: { 'security-severity': SCORE[r?.severity ?? all.find(f => f.ruleId === id)!.severity], tags: ['security', r ? 'integrity' : 'configuration'] } } }) } },
    automationDetails: { id: `mcp-shield/integrity/${s(a.candidate.snapshotId)}` },
    results: all.map(f => ({ ruleId: f.ruleId, level: LEVEL[f.severity], message: { text: f.text }, locations: [{ physicalLocation: { artifactLocation: { uri } }, ...(f.tool ? { logicalLocations: [{ name: f.tool, kind: 'function' }] } : {}) }],
      properties: { candidateRoot: a.cand.root, baselineRoot: a.base?.root } })),
    properties: { comparable: a.comparability.comparable, integrityRisk: a.integrityRisk, configurationRisk: a.configRisk.riskScore },
  }] }
  return out(JSON.stringify(sarif, null, 2))
}

export function exportMarkdown(a: Analysis, lang: Lang, log: readonly DecisionRecord[]) {
  const L = (es: string, en: string) => pick(lang, es, en)
  const m = (x: string) => mdEscape(s(x))
  const rows = [
    `# MCP-Shield · ${L('Informe de integridad', 'Integrity report')}`, '',
    `- ${L('Servidor', 'Server')}: ${m(a.candidate.target.serverLabel)} · ${L('perfil', 'profile')} ${m(a.candidate.target.profileId)} · ${m(a.candidate.target.transport)} · MCP ${m(a.candidate.target.protocolVersion)}`,
    `- ${L('Candidato', 'Candidate')}: ${m(a.candidate.snapshotId)} (${m(a.candidate.capture.completeness)}) · root \`${a.cand.root.slice(0, 16)}\``,
    a.baseline ? `- Baseline: ${m(a.baseline.snapshotId)} · root \`${a.base!.root.slice(0, 16)}\`` : `- ${L('Sin baseline aprobada (TOFU)', 'No approved baseline (TOFU)')}`,
    `- ${L('Comparable', 'Comparable')}: ${a.comparability.comparable ? L('sí', 'yes') : L('no', 'no') + ' (' + a.comparability.blockers.join(', ') + ')'}`,
    `- Integrity Risk: ${a.integrityRisk}/100 · Configuration Risk: ${a.configRisk.riskScore}/100`, '',
    `## ${L('Eventos', 'Events')}`, '', '| Evento | Tool | Confianza | Campos |', '|---|---|---|---|',
    ...a.events.map(e => `| ${e.type} | ${m(e.tool ?? '-')} | ${e.confidence} | ${m(e.changes.map(c => c.path).join(', ').slice(0, 200))} |`), '',
    `## ${L('Hallazgos', 'Findings')}`, '',
    ...a.findings.map(f => `- **${f.ruleId}** (${f.severity}) ${m(f.title)}`),
    ...a.configRisk.findings.map(f => `- **${f.ruleId}** (${f.severity}) ${m(f.title)}`), '',
    `## ${L('Decisiones', 'Decisions')}`, '', ...log.map(d => `- ${d.at} · ${d.decision} · \`${d.candidateRoot.slice(0, 16)}\`${d.reviewBy ? ' · review ' + d.reviewBy : ''}`), '',
    `> ${L('El inventario declarado no prueba el comportamiento real del servidor. Redacción best-effort.', 'A declared inventory does not prove actual server behaviour. Best-effort redaction.')}`,
  ]
  return out(rows.join('\n'))
}
