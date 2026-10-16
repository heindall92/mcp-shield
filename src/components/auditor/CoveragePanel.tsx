import { CheckCircle2, XCircle, CircleDashed, AlertOctagon, FileJson, Wrench, AlertTriangle } from 'lucide-react'
import type { ScanResult, RuleStatus } from '../../types/mcp.types'
import { usePrefs } from '../../i18n/prefs'

const ICON: Record<RuleStatus, { Icon: typeof CheckCircle2; cls: string }> = {
  PASS: { Icon: CheckCircle2, cls: 'text-emerald-400' },
  FAIL: { Icon: XCircle, cls: 'text-red-400' },
  NOT_EVALUATED: { Icon: CircleDashed, cls: 'text-slate-400' },
  ERROR: { Icon: AlertOctagon, cls: 'text-amber-300' },
}

/** Which surfaces were analysed and what each rule concluded, including rules that could not run. */
export function CoveragePanel({ res }: { res: ScanResult }) {
  const { t, lang } = usePrefs()
  const s = res.surfaces
  return (
    <section data-testid="coverage" aria-labelledby="cov-title" className="card p-4 text-[0.8125rem]">
      <h2 id="cov-title" className="text-[0.9375rem] font-semibold text-white">{t.covTitle}</h2>
      {!res.complete && <p role="status" className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-amber-100"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{t.covIncomplete}</p>}
      <div className="mt-2.5">
        <h3 className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-400">{t.covSurfaces}</h3>
        <ul className="mt-1.5 space-y-1 text-slate-300">
          <li className="flex items-center gap-1.5"><FileJson size={14} className={s.config ? 'text-emerald-400' : 'text-slate-400'} aria-hidden />{s.config ? t.covConfig(s.servers) : t.covStatus.NOT_EVALUATED}</li>
          <li className="flex items-start gap-1.5"><Wrench size={14} className={`mt-0.5 shrink-0 ${s.tools ? 'text-emerald-400' : 'text-slate-400'}`} aria-hidden />{s.tools ? t.covTools(s.tools, s.toolServers) : t.covNoTools}</li>
        </ul>
      </div>
      <ul className="mt-3 grid gap-y-1">
        {res.coverage.map(c => { const { Icon, cls } = ICON[c.status]; return (
          <li key={c.ruleId} className="flex min-w-0 items-center gap-2" title={c.diagnostic}>
            <Icon size={14} className={`shrink-0 ${cls}`} aria-hidden />
            <code className="shrink-0 text-[0.6875rem] text-slate-400">{c.ruleId}</code>
            <span className="truncate text-slate-300">{c.name[lang]}</span>
            <span className="ml-auto shrink-0 text-[0.6875rem] text-slate-400">{t.covStatus[c.status]}{c.status === 'ERROR' && c.diagnostic ? ` · ${c.diagnostic}` : ''}</span>
          </li>) })}
      </ul>
    </section>
  )
}
