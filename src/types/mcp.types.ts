/** Core MCP-Shield types. Pure data — no React. */
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type RuleCategory = 'supply-chain' | 'filesystem' | 'secrets' | 'tool-poisoning'

export interface McpToolDefinition { name: string; description?: string; inputSchema?: Record<string, unknown> }

export interface McpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  /** Non-standard but common: tool metadata snapshot (tools/list) for poisoning analysis */
  tools?: McpToolDefinition[]
}

export interface McpConfig { mcpServers: Record<string, McpServerConfig> }

export interface Finding {
  id: string
  ruleId: string
  category: RuleCategory
  severity: Severity
  server: string
  title: string
  detail: string
  evidence: string
  /** JSON-pointer-ish location, e.g. mcpServers.git.args[1] */
  location: string
  remediation: string
  cwe?: string
}

export interface RuleContext { serverName: string; server: McpServerConfig }
export type Rule = { id: string; category: RuleCategory; name: string; check: (ctx: RuleContext) => Finding[] }

export interface ScanResult {
  findings: Finding[]
  riskScore: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  serversScanned: number
  parseError?: string
  counts: Record<Severity, number>
}

export type PanelKind = 'agent' | 'wire' | 'host'
export interface SimStep {
  panel: PanelKind
  /** For agent: speaker; for wire: direction; for host: prompt style */
  role: 'user' | 'assistant' | 'client→server' | 'server→client' | 'host' | 'alert'
  content: string
  highlight?: boolean
  /** Shown only in hardened mode: the control that stopped the chain */
  blocked?: boolean
  delayMs?: number
  /** Lights the impact node in the host panel with this label */
  impact?: string
}

export interface AttackScenario {
  id: string
  title: string
  subtitle: string
  threatClass: string
  verification: 'verified' | 'illustrative'
  references: { label: string; url: string }[]
  sourceNote: string
  vulnerableConfig: McpConfig
  steps: SimStep[]
  mitigations: string[]
}

export interface SampleConfig { id: string; label: string; config: McpConfig }
