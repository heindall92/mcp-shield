import type { IntegrityEvent, MCPShieldSnapshot, Confidence } from '../domain/types'
import type { Severity, ScanResult, RuleStatus } from '../../types/mcp.types'
import type { Lang } from '../../i18n/lang'
import { pick } from '../../i18n/lang'
import { scanConfig } from '../../engine/scanner'
import { poisoningRules } from '../../engine/rules/poisoningRules'
import { smugglingRules } from '../../engine/rules/smugglingRules'

/**
 * MCPS-INT-001..008 (RFC-001 §8). Integrity Risk = how the inventory drifted from the approved baseline.
 * Configuration Risk = the existing TP-001/002/003 rules run on the candidate content. They are scored separately.
 */
export type IntRuleId = 'MCPS-INT-001' | 'MCPS-INT-002' | 'MCPS-INT-003' | 'MCPS-INT-004' | 'MCPS-INT-005' | 'MCPS-INT-006' | 'MCPS-INT-007' | 'MCPS-INT-008'
export const INT_RULES: { id: IntRuleId; name: { es: string; en: string }; severity: Severity }[] = [
  { id: 'MCPS-INT-001', severity: 'medium', name: { es: 'Nueva herramienta no aprobada', en: 'New unapproved tool' } },
  { id: 'MCPS-INT-002', severity: 'high', name: { es: 'Descripción modificada con indicios de inyección', en: 'Description changed with injection signals' } },
  { id: 'MCPS-INT-003', severity: 'high', name: { es: 'Superficie de entrada ampliada', en: 'Input surface expanded' } },
  { id: 'MCPS-INT-004', severity: 'medium', name: { es: 'Cambio de anotaciones sensibles', en: 'Sensitive annotation change' } },
  { id: 'MCPS-INT-005', severity: 'critical', name: { es: 'Payload invisible nuevo', en: 'New invisible payload' } },
  { id: 'MCPS-INT-006', severity: 'medium', name: { es: 'Nombre confundible con otra herramienta', en: 'Name confusable with another tool' } },
  { id: 'MCPS-INT-007', severity: 'medium', name: { es: 'Cambio en campos desconocidos o _meta', en: 'Change in unknown fields or _meta' } },
  { id: 'MCPS-INT-008', severity: 'high', name: { es: 'Cambio en x-mcp-header', en: 'x-mcp-header changed' } },
]

export interface IntegrityFinding { ruleId: IntRuleId; severity: Severity; tool: string; title: string; detail: string; confidence: Confidence; event: IntegrityEvent['type'] }
export interface IntCoverage { ruleId: IntRuleId; name: { es: string; en: string }; status: RuleStatus; diagnostic?: string }

/** Unicode skeleton for confusable names: NFKC, case fold, common homoglyphs, separators dropped. */
const HOMO: Record<string, string> = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'ο': 'o', 'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', '0': 'o', '1': 'l', '|': 'l', 'ı': 'i' }
export const skeleton = (s: string) => Array.from(s.normalize('NFKC').toLowerCase()).map(c => HOMO[c] ?? c).join('').replace(/rn/g, 'm').replace(/[\s_\-.\u200B-\u200F\u2060\uFEFF]/g, '').replace(/i/g, 'l')
function lev1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, d = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++d > 1) return false
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++ }
  }
  return d + (a.length - i) + (b.length - j) <= 1
}
/** Pairs of distinct names that look alike. `others` are names from the baseline and other local profiles. */
export function confusables(names: string[], others: string[]): [string, string][] {
  const out: [string, string][] = []
  for (const n of names) for (const o of others) {
    if (n === o) continue
    const a = skeleton(n), b = skeleton(o)
    if (a === b || (a.length >= 6 && lev1(a, b))) out.push([n, o])
  }
  return out
}

const SENSITIVE = ['readOnlyHint', 'destructiveHint', 'openWorldHint', 'idempotentHint']

export function evaluateIntegrity(events: IntegrityEvent[], candidate: MCPShieldSnapshot, baseline: MCPShieldSnapshot | undefined, lang: Lang, otherNames: string[] = []) {
  const L = (es: string, en: string) => pick(lang, es, en)
  const configRisk = configurationRisk(candidate, lang)
  const tpSev = (tool: string): Severity | undefined => configRisk.findings.find(f => f.title.includes(`"${tool}"`))?.severity
  const out: IntegrityFinding[] = []
  const blocked = events.some(e => e.type === 'CONTEXT_MISMATCH')
  for (const e of events) {
    const tool = e.tool ?? ''
    const f = (ruleId: IntRuleId, severity: Severity, title: string, detail: string) => out.push({ ruleId, severity, tool, title, detail, confidence: e.confidence, event: e.type })
    switch (e.type) {
      case 'TOOL_ADDED': f('MCPS-INT-001', 'medium', L(`Herramienta nueva sin aprobar: ${tool}`, `New unapproved tool: ${tool}`), L('No existía en la baseline aprobada. Revísala antes de usarla.', 'Not present in the approved baseline. Review it before use.')); break
      case 'DESCRIPTION_CHANGED': { const s = tpSev(tool); if (s) f('MCPS-INT-002', s === 'critical' ? 'critical' : 'high', L(`Descripción de ${tool} cambiada con señales de inyección`, `${tool} description changed with injection signals`), L('Las reglas de Tool Poisoning detectan directivas en el texto nuevo.', 'Tool Poisoning rules detect directives in the new text.')); break }
      case 'INPUT_EXPANDED': f('MCPS-INT-003', 'high', L(`${tool} acepta entradas nuevas o más amplias`, `${tool} accepts new or wider inputs`), e.changes.map(c => c.path).join(', ')); break
      case 'ANNOTATION_CHANGED': { const hit = e.changes.some(c => SENSITIVE.some(k => c.path === `annotations.${k}`)); f('MCPS-INT-004', hit ? 'medium' : 'low', L(`Anotaciones de ${tool} cambiadas`, `${tool} annotations changed`), L('Las anotaciones son pistas no verificadas, no controles de seguridad.', 'Annotations are unverified hints, not security controls.')); break }
      case 'INVISIBLE_PAYLOAD': f('MCPS-INT-005', e.confidence === 'high' ? 'critical' : 'high', L(`Caracteres invisibles nuevos en ${tool}`, `New invisible characters in ${tool}`), L(`Tipos: ${e.notes.join(', ')}. El modelo los lee; el usuario no.`, `Kinds: ${e.notes.join(', ')}. The model reads them; the user does not.`)); break
      case 'SCHEMA_CHANGED': if (e.notes.includes('x-mcp-header')) f('MCPS-INT-008', 'high', L(`x-mcp-header cambiado en ${tool}`, `x-mcp-header changed in ${tool}`), L('Un argumento se refleja ahora en una cabecera HTTP (Streamable HTTP).', 'An argument is now mirrored into an HTTP header (Streamable HTTP).')); break
      case 'INTEGRITY_MISMATCH': f('MCPS-INT-007', 'medium', L(`Huella distinta en ${tool}`, `Fingerprint differs for ${tool}`), e.notes.includes('unknown-fields') ? L('Cambiaron _meta o campos no estándar.', '_meta or non-standard fields changed.') : L('Cambio no clasificado: investiga manualmente.', 'Unclassified change: investigate manually.')); break
      default: break
    }
  }
  if (baseline && !blocked) {
    const added = new Set(events.filter(e => e.type === 'TOOL_ADDED').map(e => e.tool!))
    const pool = [...new Set([...baseline.tools.map(t => t.name), ...otherNames])]
    for (const [n, o] of confusables([...added], pool)) out.push({ ruleId: 'MCPS-INT-006', severity: 'medium', tool: n, confidence: 'medium', event: 'TOOL_ADDED',
      title: L(`"${n}" se parece a "${o}"`, `"${n}" looks like "${o}"`), detail: L('Posible suplantación por nombre confundible.', 'Possible impersonation through a confusable name.') })
  }
  const ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
  const coverage: IntCoverage[] = INT_RULES.map(r => !baseline ? { ruleId: r.id, name: r.name, status: 'NOT_EVALUATED', diagnostic: 'no approved baseline' }
    : blocked ? { ruleId: r.id, name: r.name, status: 'NOT_EVALUATED', diagnostic: 'context mismatch' }
    : { ruleId: r.id, name: r.name, status: out.some(f => f.ruleId === r.id) ? 'FAIL' : 'PASS' })
  return { findings: out, coverage, integrityRisk: score(out.map(f => f.severity)), configRisk }
}

const W: Record<Severity, number> = { critical: 40, high: 20, medium: 8, low: 2 }
export const score = (s: Severity[]) => Math.min(100, Math.round(100 * (1 - Math.exp(-s.reduce((n, x) => n + W[x], 0) / 60))))

/** Configuration Risk: TP-001/002/003 reused verbatim on imported (untrusted) tool content. */
export function configurationRisk(snap: MCPShieldSnapshot, lang: Lang): ScanResult {
  const tools = snap.tools.map(t => ({ name: t.name, description: [t.title, t.description].filter(Boolean).join('\n'), inputSchema: t.inputSchema }))
  return scanConfig({ mcpServers: { [snap.target.serverLabel || 'server']: { tools } } }, lang, [...poisoningRules, ...smugglingRules])
}
