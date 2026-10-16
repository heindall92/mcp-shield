import { useCallback, useEffect, useState } from 'react'
import type { SimStep } from '../../types/mcp.types'

export const STEP_MS = 430

type State = { shown: number; running: boolean; steps: SimStep[] }

/**
 * Step-by-step state machine: idle → running (step 0..N) → done.
 * - status is derived during render (no setState-in-effect cascades);
 * - the only async setState lives in a timeout that the effect cleanup always clears,
 *   so there are no updates after unmount or after the scenario changes;
 * - a new `steps` array resets the run synchronously (React "storing previous props" pattern).
 */
export function useKillChain(steps: SimStep[]) {
  const [st, setSt] = useState<State>({ shown: 0, running: false, steps })
  let cur = st
  if (st.steps !== steps) { cur = { shown: 0, running: false, steps }; setSt(cur) }
  const { shown, running } = cur
  const total = steps.length
  const status: 'idle' | 'running' | 'done' = total > 0 && shown >= total ? 'done' : running ? 'running' : 'idle'

  useEffect(() => {
    if (status !== 'running') return
    const id = window.setTimeout(() => setSt(s => (s.steps === steps && s.running ? { ...s, shown: Math.min(s.steps.length, s.shown + 1) } : s)), shown === 0 ? 120 : STEP_MS)
    return () => window.clearTimeout(id)
  }, [status, shown, steps])

  const reset = useCallback(() => setSt(s => ({ ...s, shown: 0, running: false })), [])
  const run = useCallback(() => setSt(s => ({ ...s, shown: 0, running: true })), [])
  const stepOnce = useCallback(() => setSt(s => ({ ...s, running: false, shown: Math.min(s.steps.length, s.shown + 1) })), [])

  return { shown, status, run, reset, stepOnce, current: steps[shown - 1] }
}
