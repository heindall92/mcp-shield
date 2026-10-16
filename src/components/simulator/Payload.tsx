import { Fragment } from 'react'

/** Renders ⟦malicious⟧ in red and ⟪blocked⟫ in green. */
export function Payload({ text }: { text: string }) {
  const parts = text.split(/(⟦[\s\S]*?⟧|⟪[\s\S]*?⟫)/g)
  return <>{parts.map((p, i) => p.startsWith('⟦')
    ? <mark key={i} className="rounded-sm bg-red-500/20 px-0.5 text-red-300 ring-1 ring-red-500/40 [box-shadow:0_0_12px_#ef444455]">{p.slice(1, -1)}</mark>
    : p.startsWith('⟪')
      ? <mark key={i} className="rounded-sm bg-emerald-500/15 px-0.5 font-semibold text-emerald-300 ring-1 ring-emerald-500/40">{p.slice(1, -1)}</mark>
      : <Fragment key={i}>{p}</Fragment>)}</>
}
