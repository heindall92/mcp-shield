import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { ToastCtx, type ToastKind } from './toast'

type Item = { id: number; msg: string; kind: ToastKind }

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const timers = useRef(new Map<number, number>())
  const seq = useRef(0)
  useEffect(() => { const m = timers.current; return () => m.forEach(id => window.clearTimeout(id)) }, [])
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = ++seq.current
    setItems(xs => [...xs.slice(-2), { id, msg, kind }])
    timers.current.set(id, window.setTimeout(() => { setItems(xs => xs.filter(x => x.id !== id)); timers.current.delete(id) }, 2600))
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 sm:bottom-4 flex flex-col items-center gap-2 px-4 print:hidden">
        {items.map(x => (
          <div key={x.id} data-testid="toast" className="toast-in pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-white/[0.1] bg-elevated px-3.5 py-2.5 text-[0.8125rem] text-slate-200 shadow-[0_18px_50px_-18px_rgb(var(--black)/0.7)]">
            {x.kind === 'ok' ? <CheckCircle2 size={15} className="shrink-0 text-emerald-400" aria-hidden /> : <AlertTriangle size={15} className="shrink-0 text-amber-300" aria-hidden />}{x.msg}
          </div>))}
      </div>
    </ToastCtx.Provider>
  )
}
