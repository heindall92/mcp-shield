import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search, CornerDownLeft, type LucideIcon } from 'lucide-react'

export type Command = { id: string; group: string; label: string; Icon: LucideIcon; run: () => void; keywords?: string; hint?: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** ⌘K / Ctrl+K palette. Keyboard-first: ↑↓ Home End Enter Esc; focus returns to the opener on close. */
export function CommandPalette({ open, onClose, commands, title, placeholder, empty, hint }: {
  open: boolean; onClose: () => void; commands: Command[]; title: string; placeholder: string; empty: string; hint: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const opener = useRef<Element | null>(null)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const list = useId()
  const items = useMemo(() => {
    const n = norm(q.trim())
    return n ? commands.filter(c => norm(`${c.label} ${c.group} ${c.keywords ?? ''}`).includes(n)) : commands
  }, [q, commands])
  const sel = Math.min(idx, Math.max(0, items.length - 1))

  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) { opener.current = document.activeElement; d.showModal(); input.current?.focus() }
    if (!open && d.open) { d.close(); (opener.current as HTMLElement | null)?.focus?.() }
  }, [open])
  useEffect(() => { document.getElementById(`${list}-${sel}`)?.scrollIntoView({ block: 'nearest' }) }, [sel, list])

  const runAt = (i: number) => { const c = items[i]; if (!c) return; onClose(); setQ(''); setIdx(0); window.setTimeout(c.run, 0) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((sel + 1) % Math.max(1, items.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((sel - 1 + items.length) % Math.max(1, items.length)) }
    else if (e.key === 'Home') { e.preventDefault(); setIdx(0) }
    else if (e.key === 'End') { e.preventDefault(); setIdx(items.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(sel) }
  }
  return (
    <dialog ref={ref} onClose={() => { setQ(''); setIdx(0); onClose() }} onClick={e => e.target === ref.current && onClose()} aria-label={title}
      className="modal mx-auto mt-[12vh] w-[min(94vw,36rem)] rounded-[20px] border border-white/[0.08] bg-elevated p-0 text-slate-200 shadow-[0_30px_80px_-20px_rgb(var(--black)/0.6)] backdrop:bg-black/50 backdrop:backdrop-blur-sm">
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4">
        <Search size={17} className="shrink-0 text-slate-400" aria-hidden />
        <input ref={input} data-testid="palette-input" value={q} onChange={e => { setQ(e.target.value); setIdx(0) }} onKeyDown={onKey} placeholder={placeholder}
          role="combobox" aria-expanded="true" aria-controls={list} aria-activedescendant={items.length ? `${list}-${sel}` : undefined} aria-autocomplete="list" autoComplete="off" spellCheck={false}
          className="h-12 flex-1 bg-transparent text-[0.9375rem] text-white outline-none placeholder:text-slate-400" />
        <kbd className="kbd">Esc</kbd>
      </div>
      <div id={list} role="listbox" aria-label={title} className="scroll-thin max-h-[min(60vh,26rem)] overflow-y-auto p-2">
        {!items.length && <p className="px-3 py-6 text-center text-sm text-slate-400">{empty}</p>}
        {items.map((c, i) => {
          const head = i === 0 || items[i - 1].group !== c.group ? c.group : null
          return (
            <div key={c.id}>
              {head && <div role="presentation" className="px-3 pb-1 pt-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-400">{head}</div>}
              <div id={`${list}-${i}`} role="option" aria-selected={i === sel} onMouseMove={() => i !== sel && setIdx(i)} onClick={() => runAt(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[0.875rem] ${i === sel ? 'bg-white/[0.07] text-white' : 'text-slate-300'}`}>
                <c.Icon size={16} strokeWidth={1.8} className="shrink-0 text-slate-400" aria-hidden />
                <span className="flex-1 truncate">{c.label}</span>
                {c.hint && <kbd className="kbd">{c.hint}</kbd>}
                {i === sel && <CornerDownLeft size={14} className="text-slate-400" aria-hidden />}
              </div>
            </div>)
        })}
      </div>
      <p className="border-t border-white/[0.06] px-4 py-2 text-[0.6875rem] text-slate-400">{hint}</p>
    </dialog>
  )
}
