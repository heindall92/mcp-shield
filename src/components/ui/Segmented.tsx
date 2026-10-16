import { useLayoutEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface SegOption<T extends string> { value: T; label: string; Icon?: LucideIcon; tone?: 'neutral' | 'danger' | 'safe' }
const TONE = { neutral: 'bg-white/[0.09] shadow-[inset_0_1px_0_rgb(var(--white)/0.06),0_1px_2px_rgb(var(--black)/0.25)]', danger: 'bg-red-400/[0.14] shadow-[inset_0_0_0_1px_rgb(var(--red-300)/0.18)]', safe: 'bg-emerald-400/[0.14] shadow-[inset_0_0_0_1px_rgb(var(--emerald-300)/0.18)]' }
const TEXT = { neutral: 'text-white', danger: 'text-red-200', safe: 'text-emerald-200' }

/**
 * Segmented control with a sliding selection pill (pattern inspired by 21st.dev "Segmented Tabs",
 * re-implemented in CSS without framer-motion). Arrow keys move the selection, per WAI-ARIA radiogroup.
 */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', iconOnly = false, full = false }: { options: SegOption<T>[]; value: T | null; onChange: (v: T) => void; label: string; size?: 'sm' | 'md'; iconOnly?: boolean; full?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  const current0 = options.find(o => o.value === value)
  const current = current0 ?? options[0]
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return
    const measure = () => { const b = el.querySelector<HTMLElement>('[aria-checked="true"]'); setPill(b ? { x: b.offsetLeft, w: b.offsetWidth } : null) }
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect()
  }, [value, options])
  const move = (d: number) => { const i = options.findIndex(o => o.value === value); onChange(options[(i + d + options.length) % options.length].value) }
  return (
    <div ref={wrap} role="radiogroup" aria-label={label} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1) } if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) } }}
      className={`relative isolate inline-flex rounded-[11px] border border-white/[0.07] bg-white/[0.035] p-[3px] ${full ? 'w-full' : ''}`}>
      {pill && <span aria-hidden className={`absolute bottom-[3px] top-[3px] -z-10 rounded-lg transition-[transform,width,background-color] duration-200 ease-out ${TONE[current.tone ?? 'neutral']}`} style={{ width: pill.w, transform: `translateX(${pill.x - 3}px)`, left: 3 }} />}
      {options.map(({ value: v, label: l, Icon, tone }) => {
        const on = v === value
        return (
          <button key={v} type="button" role="radio" aria-checked={on} aria-label={iconOnly ? l : undefined} title={iconOnly ? l : undefined} tabIndex={on || (!current0 && v === options[0].value) ? 0 : -1} onClick={() => onChange(v)}
            className={`press focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ${full ? 'flex-1' : ''} ${size === 'sm' ? 'h-7 px-2 text-[0.75rem]' : 'h-8 px-3 text-[0.8125rem]'} ${on ? TEXT[tone ?? 'neutral'] : 'text-slate-400 hover:text-slate-200'}`}>
            {Icon && <Icon size={size === 'sm' ? 14 : 15} strokeWidth={1.8} aria-hidden />}{!iconOnly && l}
          </button>)
      })}
    </div>
  )
}
