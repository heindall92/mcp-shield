import type { Lang } from '../i18n/lang'
import type { McpConfig, ScanResult, Severity, Rule, Finding } from '../types/mcp.types'
import { supplyChainRules } from './rules/supplyChainRules'
import { secretRules } from './rules/secretRules'
import { filesystemRules } from './rules/filesystemRules'
import { poisoningRules } from './rules/poisoningRules'
import { parseMcp } from './parse'
import { redactFinding } from './redact'

export const ALL_RULES: Rule[] = [...supplyChainRules, ...filesystemRules, ...secretRules, ...poisoningRules]
const WEIGHT: Record<Severity, number> = { critical: 25, high: 12, medium: 6, low: 2 }
const ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function parseConfig(text: string, lang: Lang = 'es'): { config?: McpConfig; error?: string; warnings: string[] } {
  return parseMcp(text, lang)
}

export function scanConfig(config: McpConfig, lang: Lang = 'es'): ScanResult {
  const findings: Finding[] = []
  for (const [serverName, server] of Object.entries(config.mcpServers ?? {}))
    for (const r of ALL_RULES) {
      try { findings.push(...r.check({ serverName, server, lang }).map(redactFinding)) } catch { /* a rule must never break the scan */ }
    }
  findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
  const counts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>
  findings.forEach(f => counts[f.severity]++)
  const raw = findings.reduce((s, f) => s + WEIGHT[f.severity], 0)
  const riskScore = Math.min(100, Math.round(100 * (1 - Math.exp(-raw / 60))))
  const grade = riskScore >= 80 ? 'F' : riskScore >= 60 ? 'D' : riskScore >= 35 ? 'C' : riskScore >= 10 ? 'B' : 'A'
  return { findings, riskScore, grade, serversScanned: Object.keys(config.mcpServers ?? {}).length, counts }
}

export function scanText(text: string, lang: Lang = 'es'): ScanResult {
  const { config, error, warnings } = parseConfig(text, lang)
  if (!config) return { findings: [], riskScore: 0, grade: 'A', serversScanned: 0, parseError: error, warnings, counts: { critical: 0, high: 0, medium: 0, low: 0 } }
  return { ...scanConfig(config, lang), warnings }
}
