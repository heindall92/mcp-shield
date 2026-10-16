import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog({ open, title, body, confirm, cancel, onConfirm, onClose }: {
  open: boolean; title: string; body: string; confirm: string; cancel: string; onConfirm: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) { d.showModal(); cancelRef.current?.focus() }
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={e => e.target === ref.current && onClose()} aria-labelledby="cd-title" aria-describedby="cd-body"
      className="modal m-auto w-[min(92vw,26rem)] rounded-[20px] border border-white/[0.08] bg-elevated p-0 text-slate-200 shadow-[0_30px_80px_-20px_rgb(var(--black)/0.6)] backdrop:bg-black/50 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-amber-300/20 bg-amber-400/10 text-amber-300"><AlertTriangle size={16} strokeWidth={1.8} aria-hidden /></span>
          <h2 id="cd-title" className="text-[1.0625rem] font-semibold text-white">{title}</h2>
        </div>
        <p id="cd-body" className="mt-3 text-[0.875rem] leading-relaxed text-slate-300">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} onClick={onClose} className="btn-ghost focus-ring text-[0.8125rem]">{cancel}</button>
          <button onClick={() => { onConfirm(); onClose() }} className="btn-primary focus-ring text-[0.8125rem]">{confirm}</button>
        </div>
      </div>
    </dialog>
  )
}
