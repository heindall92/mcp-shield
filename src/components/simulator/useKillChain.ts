import { useCallback, useEffect, useRef, useState } from 'react'
import type { SimStep } from '../../types/mcp.types'

export const STEP_MS = 430

/** Step-by-step state machine: idle → running (step 0..N) → done. */
export function useKillChain(steps: SimStep[]) {
  const [shown, setShown] = useState(0)
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const timer = useRef<number | undefined>(undefined)
  const clear = () => window.clearTimeout(timer.current)

  const reset = useCallback(() => { clear(); setShown(0); setStatus('idle') }, [])
  const run = useCallback(() => { clear(); setShown(0); setStatus('running') }, [])
  const stepOnce = useCallback(() => { clear(); setStatus(s => (s === 'running' ? 'idle' : s)); setShown(n => Math.min(steps.length, n + 1)) }, [steps.length])

  useEffect(() => {
    if (status !== 'running') return
    if (shown >= steps.length) { setStatus('done'); return }
    timer.current = window.setTimeout(() => setShown(n => n + 1), shown === 0 ? 120 : STEP_MS)
    return clear
  }, [status, shown, steps.length])

  useEffect(() => { if (shown >= steps.length && steps.length && status === 'idle') setStatus('done') }, [shown, steps.length, status])
  useEffect(() => reset, [steps, reset])

  return { shown, status, run, reset, stepOnce, current: steps[shown - 1] }
}
