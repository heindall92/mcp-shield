import { useEffect, useRef } from 'react'
import { ShieldCheck, X } from 'lucide-react'

export function ZeroTelemetryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close() }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={e => e.target === ref.current && onClose()}
      className="modal m-auto w-[min(92vw,520px)] rounded-2xl border border-white/10 bg-[#0d121b]/95 p-0 text-slate-200 backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <div className="flex items-center gap-2 text-lg font-semibold text-white"><ShieldCheck className="text-emerald-400" />100% Client-Side · Zero Telemetry<button onClick={onClose} aria-label="Cerrar" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/10"><X size={18} /></button></div>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>• El escaneo, la remediación y los exportes se ejecutan en la memoria de tu navegador.</li>
          <li>• Sin analytics, sin cookies, sin fuentes ni CDNs externos.</li>
          <li>• Content-Security-Policy con <code className="text-cyan-300">connect-src 'none'</code>: el navegador bloquea cualquier fetch/XHR/WebSocket.</li>
          <li>• Los informes se descargan con Blob local; no hay subida.</li>
        </ul>
        <div className="mt-5 rounded-xl bg-white/[0.04] p-3 text-sm"><b className="text-white">Compruébalo tú:</b> abre DevTools → pestaña <b>Network</b>, pega tu mcp.json en el Auditor y verás 0 peticiones.</div>
      </div>
    </dialog>
  )
}
