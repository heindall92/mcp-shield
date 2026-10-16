/**
 * MCPShieldSnapshot 1.0 contract (RFC-001 §4) and integrity domain types.
 * Every field coming from an MCP server is untrusted data: never instructions, never rendered as HTML,
 * never fetched (icons, $ref).
 */
export type CaptureSource = 'manual-import' | 'local-collector' | 'demo'
export type CaptureCompleteness = 'pagination-complete' | 'claimed-complete' | 'partial' | 'invalid'
export type Transport = 'stdio' | 'streamable-http'

/** Tool as defined by MCP 2026-07-28 schema.ts (name, title, description, inputSchema, outputSchema, annotations, icons, _meta). Unknown keys are kept in `extensions`. */
export interface MCPToolDefinition {
  name: string
  title?: string
  description?: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  annotations?: Record<string, unknown>
  icons?: unknown[]
  _meta?: Record<string, unknown>
  /** Fields not defined by the MCP Tool schema, preserved verbatim (untrusted). */
  extensions?: Record<string, unknown>
}

export interface SnapshotTarget {
  profileId: string
  serverLabel: string
  authContextId: string
  transport: Transport
  protocolVersion: string
}

export interface MCPShieldSnapshot {
  format: 'mcp-shield-inventory'
  schemaVersion: '1.0'
  snapshotId: string
  capturedAt: string
  target: SnapshotTarget
  provenance: { source: CaptureSource; collectorVersion?: string; verifiedCollector?: boolean }
  capture: { completeness: CaptureCompleteness; pageCount: number; toolCount: number; ttlMs?: number; cacheScope?: 'public' | 'private' }
  tools: MCPToolDefinition[]
}

export type IntegrityEventType =
  | 'TOOL_ADDED' | 'TOOL_REMOVED' | 'DESCRIPTION_CHANGED' | 'SCHEMA_CHANGED' | 'INPUT_EXPANDED'
  | 'ANNOTATION_CHANGED' | 'INVISIBLE_PAYLOAD' | 'INTEGRITY_MISMATCH' | 'CONTEXT_MISMATCH'

export type Confidence = 'high' | 'medium' | 'low'
export interface FieldChange { path: string; before?: string; after?: string }
export interface IntegrityEvent {
  type: IntegrityEventType
  tool?: string
  /** What changed, field by field, already redacted and with invisible code points shown as ⟨U+XXXX⟩. */
  changes: FieldChange[]
  confidence: Confidence
  /** Plain-language notes, e.g. "breaking: new required parameter" or "incomplete capture". */
  notes: string[]
}

/** 'provisional': a partial first capture accepted without any coverage guarantee (never a full baseline). */
export type ReviewState = 'unreviewed' | 'approved' | 'provisional' | 'rejected' | 'accepted-risk' | 'needs-revalidation'
export interface DecisionRecord {
  at: string
  decision: Exclude<ReviewState, 'unreviewed'>
  /** Root HMACs (hex) binding the decision to exact inventories. */
  candidateRoot: string
  baselineRoot?: string
  candidateSnapshotId: string
  firstBaseline: boolean
  provisional?: boolean
  tofuChecklist?: string[]
  reviewBy?: string
  note?: string
}
