import type { DecisionRecord, ReviewState } from './types'

/**
 * Human review (RFC-001 §9). Nothing is ever approved automatically: every state change is an explicit call
 * made from a user action. The log lives in memory and inside the encrypted baseline package only.
 */
export const TOFU_CHECKLIST = ['source', 'context', 'tools', 'descriptions', 'schemas', 'annotations'] as const
export type TofuItem = typeof TOFU_CHECKLIST[number]

export class DecisionError extends Error { override name = 'DecisionError' }

export interface DecideInput {
  decision: Exclude<ReviewState, 'unreviewed'>
  candidateRoot: string
  candidateSnapshotId: string
  baselineRoot?: string
  /** Required (all items) when there is no approved baseline yet. */
  tofu?: readonly string[]
  reviewBy?: string
  note?: string
  comparable: boolean
}

export function decide(log: readonly DecisionRecord[], d: DecideInput, now = () => new Date().toISOString()): DecisionRecord[] {
  const firstBaseline = !d.baselineRoot
  if (!/^[0-9a-f]{64}$/.test(d.candidateRoot)) throw new DecisionError('root')
  if ((d.decision === 'approved' || d.decision === 'accepted-risk') && !d.comparable) throw new DecisionError('context')
  if (d.decision === 'approved' && firstBaseline && !TOFU_CHECKLIST.every(i => d.tofu?.includes(i))) throw new DecisionError('tofu')
  if (d.decision === 'accepted-risk' && !(d.reviewBy && /^\d{4}-\d{2}-\d{2}$/.test(d.reviewBy))) throw new DecisionError('reviewBy')
  const rec: DecisionRecord = { at: now(), decision: d.decision, candidateRoot: d.candidateRoot, baselineRoot: d.baselineRoot, candidateSnapshotId: d.candidateSnapshotId.slice(0, 128), firstBaseline,
    ...(firstBaseline && d.decision === 'approved' ? { tofuChecklist: [...TOFU_CHECKLIST] } : {}), ...(d.reviewBy ? { reviewBy: d.reviewBy } : {}), ...(d.note ? { note: d.note.slice(0, 500) } : {}) }
  return [...log, rec]
}

/** Current state of a candidate root given the log (latest decision wins). */
export const stateOf = (log: readonly DecisionRecord[], root?: string): ReviewState => [...log].reverse().find(r => r.candidateRoot === root)?.decision ?? 'unreviewed'
