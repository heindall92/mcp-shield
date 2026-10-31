import type { HarnessFile } from '../../harness/types'
import type { RejectReason } from '../../harness/intake'

/** Harness-Shield files and rejections: memory only (App state), cleared by Reset. */
export interface HarnessState { files: HarnessFile[]; rejected: { name: string; reason: RejectReason }[] }
export const EMPTY_HARNESS: HarnessState = { files: [], rejected: [] }
