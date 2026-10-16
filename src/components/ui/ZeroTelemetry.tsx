import { useEffect, useRef } from 'react'
import { ShieldCheck, X, Check } from 'lucide-react'
import { usePrefs } from '../../i18n/prefs'

export function ZeroTelemetryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = usePrefs()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close() }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={e => e.target === ref.current && onClose()} aria-labelledby="zt-title"
      className="modal m-auto w-[min(92vw,32rem)] rounded-[20px] border border-white/[0.08] bg-elevated p-0 text-slate-200 shadow-[0_30px_80px_-20px_rgb(var(--black)/0.6)] backdrop:bg-black/50 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-emerald-300/20 bg-emerald-400/10 text-emerald-300"><ShieldCheck size={16} strokeWidth={1.8} /></span>
          <h2 id="zt-title" className="text-[1.0625rem] font-semibold text-white">{t.modalTitle}</h2>
          <button onClick={onClose} aria-label={t.close} className="press focus-ring ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"><X size={17} /></button>
        </div>
        <ul className="mt-5 space-y-2.5 text-[0.875rem] leading-relaxed text-slate-300">
          {[t.m1, t.m2, t.m3, t.m4].map(m => <li key={m} className="flex gap-2.5"><Check size={15} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />{m}</li>)}
        </ul>
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 text-[0.875rem] text-slate-300"><b className="text-white">{t.mCheck}</b> {t.mCheck2}</div>
      </div>
    </dialog>
  )
}
