import { useState, type ReactNode } from 'react'
import { IntegrityCtx as Ctx } from './integrityCtx'
import { createIntegrityStore } from '../../integrity/store'

/** Lives above the tabs so Integrity state survives tab switches. Remounted (cleared) by the app Reset. */
export function IntegrityProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createIntegrityStore)
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
