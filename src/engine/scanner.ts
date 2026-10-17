import type { Lang } from '../i18n/lang'
import type { McpConfig, ScanResult, Severity, Rule, Finding, RuleCoverage } from '../types/mcp.types'
import { supplyChainRules } from './rules/supplyChainRules'
import { secretRules } from './rules/secretRules'
import { filesystemRules } from './rules/filesystemRules'
import { poisoningRules } from './rules/poisoningRules'
import { smugglingRules } from './rules/smugglingRules'
import { parseMcp } from './parse'
import { redactFinding } from './redact'
import { bandOf } from './grades'

export const ALL_RULES: Rule[] = [...supplyChainRules, ...filesystemRules, ...secretRules, ...poisoningRules, ...smugglingRules]
const WEIGHT: Record<Severity, number> = { critical: 25, high: 12, medium: 6, low: 2 }
const ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function parseConfig(text: string, lang: Lang = 'es'): { config?: McpConfig; error?: string; warnings: string[] } {
  return parseMcp(text, lang)
}

const ZERO = () => ({ critical: 0, high: 0, medium: 0, low: 0 }) as Record<Severity, number>

export function scanConfig(config: McpConfig, lang: Lang = 'es', rules: Rule[] = ALL_RULES): ScanResult {
  const findings: Finding[] = []
  const servers = Object.entries(config.mcpServers ?? {})
  const toolServers = servers.filter(([, s]) => Array.isArray(s.tools) && s.tools.length > 0)
  const coverage: RuleCoverage[] = rules.flatMap((r): RuleCoverage[] => {
    const surface = r.surface ?? 'config'
    const ids = [{ id: r.id, name: r.name }, ...(r.emits ?? [])]
    const targets = surface === 'tools' ? toolServers : servers
    if (!targets.length) return ids.map(x => ({ ruleId: x.id, name: x.name, surface, status: 'NOT_EVALUATED' as const, diagnostic: surface === 'tools' ? 'no tool inventory' : 'no servers' }))
    const errors: string[] = []
    const hit = new Set<string>()
    for (const [serverName, server] of targets) {
      try { const f = r.check({ serverName, server, lang }); f.forEach(x => hit.add(x.ruleId)); findings.push(...f.map(redactFinding)) }
      catch (e) { errors.push(e instanceof Error && /^[A-Za-z]{1,40}$/.test(e.name) ? e.name : 'Error') }
    }
    return ids.map(x => errors.length
      ? { ruleId: x.id, name: x.name, surface, status: 'ERROR' as const, diagnostic: `${[...new Set(errors)].join(', ')} in ${errors.length}/${targets.length} servers` }
      : { ruleId: x.id, name: x.name, surface, status: hit.has(x.id) ? 'FAIL' as const : 'PASS' as const })
  })
  findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
  const counts = ZERO()
  findings.forEach(f => counts[f.severity]++)
  const raw = findings.reduce((s, f) => s + WEIGHT[f.severity], 0)
  const riskScore = Math.min(100, Math.round(100 * (1 - Math.exp(-raw / 60))))
  const complete = servers.length > 0 && !coverage.some(c => c.status === 'ERROR')
  const letter = bandOf(riskScore).g
  const grade: ScanResult['grade'] = !complete && letter === 'A' ? 'N/A' : letter
  return { findings, riskScore, grade, complete, coverage, serversScanned: servers.length, counts,
    surfaces: { config: true, servers: servers.length, toolServers: toolServers.length, tools: toolServers.reduce((n, [, s]) => n + (s.tools?.length ?? 0), 0) } }
}

export function scanText(text: string, lang: Lang = 'es'): ScanResult {
  const { config, error, warnings } = parseConfig(text, lang)
  if (!config) return { findings: [], riskScore: 0, grade: 'N/A', complete: false, serversScanned: 0, parseError: error, warnings, counts: ZERO(),
    coverage: ALL_RULES.flatMap(r => [{ id: r.id, name: r.name }, ...(r.emits ?? [])].map(x => ({ ruleId: x.id, name: x.name, surface: r.surface ?? 'config', status: 'NOT_EVALUATED' as const, diagnostic: 'parse error' }))),
    surfaces: { config: false, servers: 0, toolServers: 0, tools: 0 } }
  return { ...scanConfig(config, lang), warnings }
}
