import { createContext, useContext, useSyncExternalStore } from 'react'
import type { IntegrityStore } from '../../integrity/store'

export const IntegrityCtx = createContext<IntegrityStore | null>(null)
export function useIntegrity() {
  const store = useContext(IntegrityCtx)
  if (!store) throw new Error('IntegrityProvider missing')
  const state = useSyncExternalStore(store.subscribe, store.get)
  return { ...state, set: store.set, reset: store.reset }
}
