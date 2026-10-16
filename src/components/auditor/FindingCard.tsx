import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Finding } from '../../types/mcp.types'
import { CONTROL_MAP } from '../../engine/governance'

export function FindingCard({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false)
  const m = CONTROL_MAP[f.category]
  return (
    <article className="rounded-xl border border-white/[0.07] bg-white/[0.02] transition-colors hover:border-white/15">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="press-soft flex w-full items-start gap-2.5 p-3 text-left">
        <span className={`sev-${f.severity} mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold uppercase`}>{f.severity}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-medium text-slate-100">{f.title}</span>
          <span className="mt-0.5 block font-mono text-[0.65625rem] text-slate-500">{f.ruleId} · {f.server}{f.cwe ? ` · ${f.cwe}` : ''}</span>
        </span>
        <ChevronRight size={15} className={`mt-1 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="space-y-2 border-t border-white/5 px-3 pb-3 pt-2 text-[0.78125rem] text-slate-300">
        <p>{f.detail}</p>
        <pre className="whitespace-pre-wrap break-all rounded-lg bg-black/40 p-2 font-mono text-[0.6875rem] text-amber-200/90">{f.evidence}</pre>
        <p><b className="text-emerald-300">Corrección:</b> {f.remediation}</p>
        <p className="text-[0.6875rem] text-slate-500">{m.owasp} · NSA: {m.nsa} · ISO/IEC 42001 {m.iso}</p>
      </div>}
    </article>
  )
}
