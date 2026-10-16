import { ExternalLink, Landmark, Scale } from 'lucide-react'
import { CONTROL_MAP, FRAMEWORKS } from '../../engine/governance'
import { ALL_RULES } from '../../engine/scanner'
import { incidents } from '../../data/incidents'
import type { RuleCategory } from '../../types/mcp.types'

const LABEL: Record<RuleCategory, string> = { 'supply-chain': 'Supply Chain', filesystem: 'Filesystem / Sandbox', secrets: 'Secretos', 'tool-poisoning': 'Tool Poisoning' }

export function Governance() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-cyan-300/80">Red Team ↔ DevSecOps ↔ CISO</p>
        <h1 className="mt-1 display text-white">Matriz de gobernanza</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">Cada regla SAST mapeada a los temas de cada marco. Mapeo <b>orientativo</b> elaborado por MCP-Shield, no una certificación ni un crosswalk oficial.</p>
      </div>
      <div className="scroll-thin overflow-x-auto rounded-2xl border border-white/[0.07]">
        <table className="w-full min-w-[860px] text-left text-[0.78125rem]">
          <thead className="bg-white/[0.03] text-[0.6875rem] uppercase tracking-wider text-slate-400">
            <tr><th className="p-3">Categoría · reglas</th>{FRAMEWORKS.map(f => <th key={f.id} className="p-3 font-semibold">{f.name}<div className="font-normal normal-case tracking-normal text-slate-500">{f.date}</div></th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {(Object.keys(CONTROL_MAP) as RuleCategory[]).map(c => (
              <tr key={c} className="align-top hover:bg-white/[0.02]">
                <td className="p-3"><div className="font-semibold text-white">{LABEL[c]}</div><div className="mt-1 font-mono text-[0.65625rem] text-slate-500">{ALL_RULES.filter(r => r.category === c).map(r => r.id).join(' · ')}</div></td>
                <td className="p-3 text-slate-300">{CONTROL_MAP[c].nsa}</td><td className="p-3 text-slate-300">{CONTROL_MAP[c].owasp}</td>
                <td className="p-3 text-slate-300">{CONTROL_MAP[c].iso}</td><td className="p-3 text-slate-300">{CONTROL_MAP[c].csa}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {incidents.map(i => (
          <a key={i.id} href={i.url} target="_blank" rel="noreferrer noopener" className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-cyan-400/30">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Landmark size={15} className="text-cyan-300" />{i.name}<span className="ml-auto text-[0.6875rem] font-normal text-slate-500">{i.date}</span></div>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-slate-300">{i.fact}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300"><Scale size={12} />{i.lesson}<ExternalLink size={11} className="ml-auto text-slate-500 group-hover:text-cyan-300" /></p>
          </a>))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">{FRAMEWORKS.map(f => <li key={f.id}><a className="inline-flex items-center gap-1 text-cyan-300 hover:underline" href={f.url} target="_blank" rel="noreferrer noopener">{f.name}<ExternalLink size={11} /></a></li>)}</ul>
    </div>
  )
}
