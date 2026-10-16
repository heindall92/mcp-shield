import type { ReactNode } from 'react'

const DOT = { neutral: 'bg-slate-400', success: 'bg-emerald-400', warning: 'bg-amber-300', danger: 'bg-red-400', info: 'bg-cyan-400' }
const TXT = { neutral: 'text-slate-300', success: 'text-emerald-200', warning: 'text-amber-200', danger: 'text-red-200', info: 'text-cyan-200' }

/** Outline badge with a status dot (pattern seen in 21st.dev / Cnippet table badges). */
export function Badge({ tone = 'neutral', children, className = '' }: { tone?: keyof typeof DOT; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[0.6875rem] font-medium ${TXT[tone]} ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />{children}
    </span>
  )
}
