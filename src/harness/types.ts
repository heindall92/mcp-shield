/** Harness-Shield: static audit of AI agent configuration files. Pure data, no React. */
import type { Severity } from '../types/mcp.types'
import type { Bi } from '../i18n/lang'

export type HarnessKind = 'skill' | 'claude' | 'agents' | 'cursorrules' | 'mcp' | 'bash' | 'python' | 'powershell' | 'markdown' | 'json' | 'config' | 'text'
export type Confidence = 'high' | 'medium' | 'low'
export type HarnessRuleId = 'AHS-01' | 'AHS-02' | 'AHS-03' | 'AHS-04' | 'AHS-05' | 'AHS-06' | 'AHS-07' | 'AHS-08'

export interface HarnessFile { name: string; text: string; kind?: HarnessKind }

export interface HarnessFinding {
  id: string
  ruleId: HarnessRuleId
  severity: Severity
  confidence: Confidence
  file: string
  kind: HarnessKind
  /** 1-based line in the original file. */
  line: number
  /** Printable, redacted, at most 140 characters. Invisible code points appear as ⟨U+XXXX⟩. */
  snippet: string
  title: string
  detail: string
  remediation: string
  /** Decoded hidden text (Unicode tags, base64), printable and capped. */
  hidden?: string
  owasp: string
  iso: string[]
  cwe?: string
}

export interface HarnessRuleMeta { id: HarnessRuleId; name: Bi; owasp: string; owaspName: Bi; iso: string[]; cwe?: string }

export interface HarnessFileResult { name: string; kind: HarnessKind; lines: number; findings: number; truncatedLines: number }

export interface HarnessResult {
  findings: HarnessFinding[]
  files: HarnessFileResult[]
  riskScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A'
  counts: Record<Severity, number>
}
