import { ExternalLink, Landmark, Scale } from 'lucide-react'
import { controlMap, frameworks } from '../../engine/governance'
import { ALL_RULES } from '../../engine/scanner'
import { getIncidents } from '../../data/incidents'
import { usePrefs } from '../../i18n/prefs'
import type { RuleCategory } from '../../types/mcp.types'

export function Governance() {
  const { t, lang } = usePrefs()
  const LABEL: Record<RuleCategory, string> = { 'supply-chain': t.catSupply, filesystem: t.catFs, secrets: t.catSec, 'tool-poisoning': t.catTp }
  const cm = controlMap(lang)
  const fw = frameworks(lang)
  return (
    <div className="space-y-5">
      <div>
        <p className="kicker">{t.govKicker}</p>
        <h1 className="display mt-1.5 text-white">{t.govTitle}</h1>
        <p className="mt-1.5 max-w-3xl text-[0.875rem] leading-relaxed text-slate-400">{t.govIntro}</p>
      </div>
      <div tabIndex={0} role="region" aria-label="Matriz de gobernanza / governance matrix" className="focus-ring scroll-thin overflow-x-auto rounded-[18px] border border-white/[0.07] bg-surface">
        <table className="w-full min-w-[54rem] text-left text-[0.8125rem]">
          <thead className="border-b border-white/[0.06] text-[0.6875rem] uppercase tracking-[0.08em] text-slate-400">
            <tr><th scope="col" className="p-3.5 font-medium">{t.catRules}</th>{fw.map(f => <th scope="col" key={f.id} className="p-3.5 font-semibold text-slate-300">{f.name}<div className="mt-0.5 font-normal normal-case tracking-normal text-slate-400">{f.date}</div></th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {(Object.keys(cm) as RuleCategory[]).map(c => (
              <tr key={c} className="align-top transition-colors hover:bg-white/[0.02]">
                <th scope="row" className="p-3.5 text-left font-normal"><div className="font-semibold text-white">{LABEL[c]}</div><div className="mt-1 font-mono text-[0.6875rem] text-slate-400">{ALL_RULES.filter(r => r.category === c).map(r => r.id).join(' · ')}</div></th>
                <td className="p-3.5 text-slate-300">{cm[c].nsa}</td><td className="p-3.5 text-slate-300">{cm[c].owasp}</td>
                <td className="p-3.5 text-slate-300">{cm[c].iso}</td><td className="p-3.5 text-slate-300">{cm[c].csa}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {getIncidents(lang).map(i => (
          <a key={i.id} href={i.url} target="_blank" rel="noreferrer noopener" className="card press-soft focus-ring group block p-4 transition-colors hover:border-white/[0.14]">
            <div className="flex items-center gap-2 text-[0.875rem] font-semibold text-white"><Landmark size={15} strokeWidth={1.8} className="text-slate-400" aria-hidden />{i.name}<span className="ml-auto text-[0.6875rem] font-normal text-slate-400">{i.date}</span></div>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-slate-300">{i.fact}</p>
            <p className="mt-2.5 flex items-center gap-1.5 text-[0.75rem] text-emerald-300"><Scale size={12} aria-hidden />{i.lesson}<ExternalLink size={11} className="ml-auto text-slate-400 group-hover:text-cyan-300" aria-hidden /></p>
          </a>))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem]">{fw.map(f => <li key={f.id}><a className="focus-ring inline-flex items-center gap-1 rounded text-accent hover:underline" href={f.url} target="_blank" rel="noreferrer noopener">{f.name}<ExternalLink size={11} aria-hidden /></a></li>)}</ul>
    </div>
  )
}
