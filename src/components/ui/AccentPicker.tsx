import { useEffect, useRef, useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { ACCENT_IDS, type Accent } from '../../i18n/accent'

/* Swatches drawn with the same tokens the app uses, so each one shows the accent of the active theme. */
const SWATCH: Record<Accent, { dark: string; light: string }> = {
  azul: { dark: '#6b9bff', light: '#1a4fe0' }, rosa: { dark: '#ff7ab8', light: '#b8155a' }, solar: { dark: '#ffb020', light: '#8a4a00' },
  glaciar: { dark: '#5ee7f5', light: '#0a6a7d' }, orquidea: { dark: '#b79bff', light: '#5b35f0' }, verde: { dark: '#5aa86a', light: '#1a6b36' }, rojo: { dark: '#ff6b6b', light: '#b3141a' },
}

/** Row of accent swatches. Toggle buttons in the popover; menuitemradio options inside the mobile menu (role=menu). */
export function AccentSwatches({ value, onChange, names, theme, label, menu = false }: { value: Accent; onChange: (a: Accent) => void; names: Record<Accent, string>; theme: 'light' | 'dark'; label: string; menu?: boolean }) {
  return (
    <div role="group" aria-label={label} className="flex flex-nowrap gap-1" data-testid="accent-swatches">
      {ACCENT_IDS.map(id => {
        const on = id === value
        return (
          <button key={id} type="button" {...(menu ? { role: 'menuitemradio', 'aria-checked': on } : { 'aria-pressed': on })} title={names[id]} aria-label={names[id]} data-accent-id={id} onClick={() => onChange(id)}
            className={`press focus-ring grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-elevated ${on ? 'ring-2 ring-slate-200' : 'hover:ring-1 hover:ring-slate-500'}`}>
            <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full" style={{ background: SWATCH[id][theme] }}>{on && <Check size={13} strokeWidth={2.6} color={theme === 'dark' ? '#0b0f16' : '#ffffff'} />}</span>
          </button>)
      })}
    </div>
  )
}

/** Header button that opens the accent popover. Escape and outside clicks close it; focus returns to the button. */
export function AccentPicker(props: { value: Accent; onChange: (a: Accent) => void; names: Record<Accent, string>; theme: 'light' | 'dark'; label: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector<HTMLElement>('button')?.focus() } }
    addEventListener('pointerdown', down); addEventListener('keydown', key)
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('[aria-pressed=true]')?.focus())
    return () => { removeEventListener('pointerdown', down); removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={wrap} className="relative hidden sm:block">
      <button type="button" data-testid="accent-btn" aria-label={props.label} title={props.label} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="press focus-ring grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-accent hover:bg-white/[0.06]"><Palette size={16} aria-hidden /></button>
      {open && <div className="menu-pop absolute right-0 top-10 z-30 w-[18rem] rounded-2xl border border-white/[0.08] p-3 shadow-[0_16px_40px_-12px_rgb(var(--black)/0.6)]">
        <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-400">{props.label}</p>
        <AccentSwatches {...props} onChange={a => props.onChange(a)} />
        <p className="mt-2 text-[0.75rem] text-slate-400">{props.names[props.value]}</p>
      </div>}
    </div>
  )
}
