import { useEffect, useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function Panel({ title, kicker, Icon, tone, children, count }: { title: string; kicker: string; Icon: LucideIcon; tone: 'slate' | 'cyan' | 'red'; children: ReactNode; count: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = ref.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }, [count])
  const ring = tone === 'red' ? 'from-red-500/30' : tone === 'cyan' ? 'from-cyan-400/30' : 'from-slate-400/20'
  return (
    <section className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-b ${ring} to-transparent p-px`}>
      <div className="flex min-h-0 flex-1 flex-col rounded-[15px] bg-[#0b0f16]/95">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
          <Icon size={15} className={tone === 'red' ? 'text-red-400' : tone === 'cyan' ? 'text-cyan-300' : 'text-slate-300'} />
          <h3 className="text-[0.8125rem] font-semibold text-slate-100">{title}</h3>
          <span className="ml-auto text-[0.625rem] uppercase tracking-[0.14em] text-slate-500">{kicker}</span>
        </header>
        <div ref={ref} className="scroll-thin flex-1 space-y-2.5 overflow-y-auto p-3 [mask-image:linear-gradient(to_bottom,transparent,black_12px)]">{children}</div>
      </div>
    </section>
  )
}
