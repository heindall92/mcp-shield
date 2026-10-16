import { useEffect, useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Window-style panel: hairline border, quiet chrome, inner top highlight. */
export function Panel({ title, kicker, Icon, children, count, chrome = false }: { title: string; kicker: string; Icon: LucideIcon; children: ReactNode; count: number; chrome?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  // Auto-scroll only when the panel really scrolls (desktop fixed-height grid). On mobile the panel sizes to its
  // content: no inner scroll, no mask (WebKit failed to repaint a masked scroller, leaving a blank area).
  useEffect(() => { const el = ref.current; if (el && el.scrollHeight > el.clientHeight + 1) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' }) }, [count])
  return (
    <section className="flex flex-col overflow-hidden rounded-[18px] lg:min-h-0 border border-white/[0.07] bg-surface shadow-[inset_0_1px_0_rgb(var(--white)/0.04)]">
      <header className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5">
        {chrome && <span aria-hidden className="mr-0.5 flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />)}</span>}
        <Icon size={15} strokeWidth={1.8} className="text-slate-400" aria-hidden />
        <h3 className="text-[0.8125rem] font-semibold text-slate-100">{title}</h3>
        <span className="ml-auto font-mono text-[0.6875rem] text-slate-400">{kicker}</span>
      </header>
      <div ref={ref} tabIndex={0} role="log" aria-label={title} className="focus-ring scroll-thin flex-1 space-y-2.5 p-3 lg:min-h-0 lg:overflow-y-auto lg:[mask-image:linear-gradient(to_bottom,transparent,black_12px)]">{children}</div>
    </section>
  )
}
