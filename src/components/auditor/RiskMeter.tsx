import { GRADE_BANDS as BANDS, bandOf } from '../../engine/grades'

/**
 * Risk meter: a linear 0–100 track split into the grade bands the scanner uses (A < 10 ≤ B < 35 ≤ C < 60 ≤ D < 80 ≤ F),
 * with a needle at the score. MCP-Shield's own figure: rings and circles belong to Rosetta in the ecosystem.
 * Colour never stands alone: every band is labelled with its letter and the score and grade are written out.
 */


export function RiskMeter({ score, grade, label, gradeWord, riskWord }: { score: number; grade: string; label: string; gradeWord: string; riskWord: string }) {
  const s = Math.max(0, Math.min(100, score))
  const active = bandOf(s)
  return (
    <div data-testid="risk-meter" role="img" aria-label={label} className="w-full">
      <div aria-hidden className="flex items-baseline gap-2">
        <span className="font-mono text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white tabular-nums">{s}</span>
        <span className="text-[0.75rem] text-slate-400">/100 · {riskWord}</span>
        <span data-testid="grade-chip" className={`ml-auto rounded-md px-2 py-0.5 text-[0.75rem] font-semibold ${grade === 'N/A' ? 'sev-low' : `meter-chip-${active.tone}`}`}>{gradeWord} {grade}</span>
      </div>
      <div aria-hidden className="relative mt-3">
        <div className="flex h-2.5 gap-[3px]">
          {BANDS.map(b => <span key={b.g} className={`meter-${b.tone} h-full rounded-[3px] transition-opacity duration-300 ${b === active ? 'opacity-100' : 'opacity-35'}`} style={{ width: `${b.to - b.from}%` }} />)}
        </div>
        <span className="meter-needle absolute -top-1 h-[1.125rem] w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgb(var(--surface))]" style={{ left: `${s}%` }} />
        <div className="mt-1.5 flex gap-[3px] font-mono text-[0.6875rem] text-slate-400">
          {BANDS.map(b => <span key={b.g} className={`text-center ${b === active ? 'font-semibold text-slate-100' : ''}`} style={{ width: `${b.to - b.from}%` }}>{b.g}</span>)}
        </div>
      </div>
    </div>
  )
}
