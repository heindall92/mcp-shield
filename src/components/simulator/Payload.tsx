import { Fragment } from 'react'

/** Renders ⟦malicious⟧ in red and ⟪blocked⟫ in green. */
export function Payload({ text }: { text: string }) {
  const parts = text.split(/(⟦[\s\S]*?⟧|⟪[\s\S]*?⟫)/g)
  return <>{parts.map((p, i) => p.startsWith('⟦')
    ? <mark key={i} className="rounded-[3px] bg-red-400/[0.14] px-0.5 text-red-200 ring-1 ring-inset ring-red-400/25">{p.slice(1, -1)}</mark>
    : p.startsWith('⟪')
      ? <mark key={i} className="rounded-[3px] bg-emerald-400/[0.14] px-0.5 font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/25">{p.slice(1, -1)}</mark>
      : <Fragment key={i}>{p}</Fragment>)}</>
}
