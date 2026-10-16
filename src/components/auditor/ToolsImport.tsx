import { useRef, useState } from 'react'
import { Upload, X, Wrench } from 'lucide-react'
import type { McpToolDefinition } from '../../types/mcp.types'
import { parseToolsList } from '../../engine/toolsImport'
import { usePrefs } from '../../i18n/prefs'

/** Paste or open a tools/list response and merge it into one server. In memory only. */
export function ToolsImport({ servers, imported, onImport, onRemove }: {
  servers: string[]; imported: Record<string, McpToolDefinition[]>; onImport: (server: string, tools: McpToolDefinition[]) => void; onRemove: (server: string) => void
}) {
  const { t } = usePrefs()
  const [server, setServer] = useState('')
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const target = servers.includes(server) ? server : servers[0] ?? ''
  const run = (src: string) => {
    setOk('')
    const r = parseToolsList(src)
    if (!r.tools) { setErr(t.tiErr[r.error ?? 'shape']); return }
    setErr(''); onImport(target, r.tools); setText(''); setOk(t.tiDone(r.tools.length, target))
  }
  if (!servers.length) return null
  return (
    <section data-testid="tools-import" aria-labelledby="ti-title" className="card no-print p-4 text-[0.8125rem]">
      <h2 id="ti-title" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-white"><Wrench size={15} strokeWidth={1.8} aria-hidden />{t.tiTitle}</h2>
      <p className="mt-1 text-slate-400">{t.tiBody}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[0.75rem] text-slate-300">{t.tiServer}
          <select data-testid="ti-server" value={target} onChange={e => setServer(e.target.value)} className="focus-ring h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-slate-200">
            {servers.map(s => <option key={s} value={s} className="bg-elevated">{s}</option>)}
          </select>
        </label>
        <button onClick={() => fileRef.current?.click()} className="btn-chip focus-ring h-9"><Upload size={13} aria-hidden />{t.tiFile}</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(run); e.target.value = '' }} />
      </div>
      <label className="mt-2 block text-[0.75rem] text-slate-300">{t.tiPaste}
        <textarea data-testid="ti-text" value={text} onChange={e => setText(e.target.value)} spellCheck={false} rows={4}
          className="focus-ring scroll-thin mt-1 w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 font-mono text-[0.75rem] text-slate-200 placeholder:text-slate-500" placeholder='{"jsonrpc":"2.0","id":1,"result":{"tools":[…]}}' />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button data-testid="ti-import" onClick={() => run(text)} className="btn-ghost focus-ring text-[0.75rem]">{t.tiImport}</button>
        {err && <p role="alert" className="text-[0.75rem] text-red-300">{err}</p>}
        {ok && <p role="status" className="text-[0.75rem] text-emerald-300">{ok}</p>}
      </div>
      {Object.keys(imported).length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{Object.entries(imported).map(([s, list]) =>
        <li key={s} className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] py-0.5 pl-2.5 pr-1 text-[0.75rem] text-slate-300">{s} · {list.length} {list.length === 1 ? 'tool' : 'tools'}
          <button onClick={() => onRemove(s)} aria-label={t.tiRemove(s)} className="focus-ring grid h-5 w-5 place-items-center rounded-full hover:bg-white/[0.08]"><X size={12} aria-hidden /></button></li>)}</ul>}
    </section>
  )
}
