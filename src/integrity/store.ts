import type { MCPShieldSnapshot, DecisionRecord } from './domain/types'
import type { HmacKey } from './crypto/hashes'

/**
 * In-memory Integrity state, owned above the tab views so switching tabs never loses it.
 * Never persisted (no storage, no logging); cleared by the app-wide Reset.
 */
export interface IntegrityState {
  key?: HmacKey
  baseline?: { snap: MCPShieldSnapshot; approved: boolean; provisional: boolean }
  candidate?: MCPShieldSnapshot
  log: DecisionRecord[]
}
export interface IntegrityStore { get: () => IntegrityState; set: (p: Partial<IntegrityState>) => void; reset: () => void; subscribe: (f: () => void) => () => void }

export function createIntegrityStore(): IntegrityStore {
  let state: IntegrityState = { log: [] }
  const subs = new Set<() => void>()
  const emit = () => subs.forEach(f => f())
  return {
    get: () => state,
    set: p => { state = { ...state, ...p }; emit() },
    reset: () => { state = { log: [] }; emit() },
    subscribe: f => { subs.add(f); return () => { subs.delete(f) } },
  }
}
