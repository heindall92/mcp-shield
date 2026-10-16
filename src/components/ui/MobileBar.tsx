import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Ellipsis, Sun, Moon, CircleHelp, ShieldCheck, Check } from 'lucide-react'

/** Horizontally scrollable tab bar for narrow screens: snap, fade edges, active tab kept in view. */
export function MobileTabs<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; short?: string; Icon?: LucideIcon }[]; value: T | null; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Scroll only the bar (never the page) so the active tab sits centred.
    const bar = ref.current, el = bar?.querySelector<HTMLElement>('[aria-current=page]')
    if (bar && el) bar.scrollTo({ left: el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2 })
  }, [value])
  return (
    <div ref={ref} data-testid="mobile-tabs" className="no-scrollbar fade-x relative flex snap-x snap-proximity gap-1 overflow-x-auto px-3 py-2" role="list" aria-label={label}>
      {options.map(({ value: v, label: l, short, Icon }) => (
        <button key={v} role="listitem" aria-current={value === v ? 'page' : undefined} onClick={() => onChange(v)}
          className={`press focus-ring inline-flex h-8 shrink-0 snap-start items-center last:snap-end gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.8125rem] font-medium ${value === v ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:text-white'}`}>
          {Icon && <Icon size={14} aria-hidden />}{short ?? l}
        </button>))}
    </div>
  )
}

/** Single overflow menu for narrow screens: language, theme, help, privacy guarantee. */
export function MobileMenu({ label, lang, setLang, theme, setTheme, onHelp, onZero, t }: {
  label: string; lang: 'es' | 'en'; setLang: (l: 'es' | 'en') => void; theme: string; setTheme: (t: 'light' | 'dark') => void; onHelp: () => void; onZero: () => void
  t: { langLabel: string; themeLabel: string; themeLight: string; themeDark: string; tabHelp: string; badgeLong: string }
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector<HTMLElement>('button')?.focus() } }
    addEventListener('pointerdown', down); addEventListener('keydown', key)
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('[role=menu] button')?.focus())
    return () => { removeEventListener('pointerdown', down); removeEventListener('keydown', key) }
  }, [open])
  const item = 'focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.875rem] text-slate-200 hover:bg-white/[0.06]'
  const pill = (on: boolean) => `focus-ring inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[0.8125rem] font-medium ${on ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-white'}`
  const run = (f: () => void) => () => { setOpen(false); f() }
  return (
    <div ref={wrap} className="relative sm:hidden">
      <button data-testid="mobile-menu" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="press focus-ring grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:text-white"><Ellipsis size={16} aria-hidden /></button>
      {open && <div role="menu" aria-label={label} className="menu-pop absolute right-0 top-10 z-30 w-64 rounded-2xl border border-white/[0.08] p-2 shadow-[0_16px_40px_-12px_rgb(var(--black)/0.6)]">
        <div className="px-2.5 pb-1 pt-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-400">{t.langLabel}</div>
        <div className="flex gap-1 px-1 pb-2">{(['es', 'en'] as const).map(l => <button key={l} role="menuitemradio" aria-checked={lang === l} onClick={() => setLang(l)} className={pill(lang === l)}>{lang === l && <Check size={13} aria-hidden />}{l.toUpperCase()}</button>)}</div>
        <div className="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-400">{t.themeLabel}</div>
        <div className="flex gap-1 px-1 pb-2">{(['light', 'dark'] as const).map(x => { const I = x === 'light' ? Sun : Moon; return <button key={x} role="menuitemradio" aria-checked={theme === x} onClick={() => setTheme(x)} className={pill(theme === x)}><I size={13} aria-hidden />{x === 'light' ? t.themeLight : t.themeDark}</button> })}</div>
        <div className="my-1 h-px bg-white/[0.06]" />
        <button role="menuitem" onClick={run(onHelp)} className={item}><CircleHelp size={15} aria-hidden />{t.tabHelp}</button>
        <button role="menuitem" onClick={run(onZero)} className={item}><ShieldCheck size={15} aria-hidden />{t.badgeLong}</button>
      </div>}
    </div>
  )
}

/** Fixed bottom tab bar for narrow screens (Apple-style): translucent, safe-area aware, 44px+ targets. */
export function BottomTabs<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; Icon: LucideIcon }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <nav aria-label={label} data-testid="bottom-bar" className="bottom-bar fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)] sm:hidden print:hidden">
      <ul className="mx-auto flex max-w-md">
        {options.map(({ value: v, label: l, Icon }) => { const on = v === value; return (
          <li key={v} className="min-w-0 flex-1">
            <a href={`#${v}`} aria-current={on ? 'page' : undefined} onClick={e => { e.preventDefault(); onChange(v) }}
              className={`press focus-ring flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 pt-1.5 pb-1 text-[0.625rem] font-medium leading-tight tracking-[-0.01em] active:opacity-60 ${on ? 'text-white' : 'text-slate-400'}`}>
              <span aria-hidden className={`grid h-7 w-12 place-items-center rounded-full transition-colors duration-200 ${on ? 'bg-white/[0.1]' : ''}`}><Icon size={19} strokeWidth={on ? 2.2 : 1.8} /></span>
              <span data-label className="whitespace-nowrap">{l}</span>
            </a>
          </li>) })}
      </ul>
    </nav>
  )
}
