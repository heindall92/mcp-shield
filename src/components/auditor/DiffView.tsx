import { useMemo } from 'react'
import { lineDiff } from '../../engine/diff'

export function DiffView({ before, after }: { before: string; after: string }) {
  const d = useMemo(() => lineDiff(before, after), [before, after])
  return (
    <div className="grid md:grid-cols-2">
      <div className="border-b border-white/5 md:border-b-0 md:border-r"><div className="px-4 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-red-300">Vulnerable</div>
        <pre className="scroll-thin max-h-[420px] overflow-auto pb-3 font-mono text-[0.71875rem] leading-[1.6]">{d.filter(l => l.type !== 'add').map((l, i) => <div key={i} className={l.type === 'del' ? 'bg-red-400/[0.08] px-4 text-red-200' : 'px-4 text-slate-400'}>{l.type === 'del' ? '− ' : '  '}{l.text}</div>)}</pre></div>
      <div><div className="px-4 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-emerald-300">Hardened</div>
        <pre className="scroll-thin max-h-[420px] overflow-auto pb-3 font-mono text-[0.71875rem] leading-[1.6]">{d.filter(l => l.type !== 'del').map((l, i) => <div key={i} className={l.type === 'add' ? 'bg-emerald-400/[0.08] px-4 text-emerald-200' : 'px-4 text-slate-400'}>{l.type === 'add' ? '+ ' : '  '}{l.text}</div>)}</pre></div>
    </div>
  )
}
