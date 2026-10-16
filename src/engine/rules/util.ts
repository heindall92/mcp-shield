import type { Finding, RuleCategory, Severity } from '../../types/mcp.types'
let n = 0
export const mk = (f: Omit<Finding, 'id'>): Finding => ({ id: `F-${++n}`, ...f })
export const sev = (s: Severity) => s
export type { RuleCategory }
