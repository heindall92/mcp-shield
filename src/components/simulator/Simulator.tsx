import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, RotateCcw, StepForward, MessageSquare, Network, TerminalSquare, ShieldAlert, ShieldCheck, ExternalLink, Siren, ArrowRight } from 'lucide-react'
import { getScenarios } from '../../data/attackScenarios'
import { stepsFor, nodesFor, type SimMode, type GraphNode } from '../../engine/simulation'
import { usePrefs } from '../../i18n/prefs'
import { useKillChain } from './useKillChain'
import { KillChainGraph } from './KillChainGraph'
import { Panel } from './Panel'
import { Payload } from './Payload'
import { Segmented } from '../ui/Segmented'
import { Badge } from '../ui/Badge'
import type { SimStep } from '../../types/mcp.types'

export function Simulator({ onAudit, autoRun = false }: { onAudit: (json: string) => void; autoRun?: boolean }) {
  const { t, lang } = usePrefs()
  const scenarios = useMemo(() => getScenarios(lang), [lang])
  const [sid, setSid] = useState(scenarios[0].id)
  const [mode, setMode] = useState<SimMode>('vulnerable')
  const scenario = scenarios.find(s => s.id === sid)!
  const steps = useMemo(() => stepsFor(scenario, mode, lang), [scenario, mode, lang])
  const { shown, status, run, reset, stepOnce, current } = useKillChain(steps)
  // "See an attack in 5 s": start the default kill-chain once, on explicit user request from the Auditor.
  const started = useRef(false)
  useEffect(() => { if (autoRun && !started.current) { started.current = true; run() } }, [autoRun, run])
  const visible = steps.slice(0, shown).map((s, i) => ({ ...s, i }))
  const reached = useMemo(() => new Set<GraphNode>(steps.slice(0, shown).flatMap(nodesFor)), [steps, shown])
  const impact = visible.find(s => s.impact)
  const compromised = !!impact && !impact.blocked
  const hardenedWin = !!impact?.blocked
  const by = (p: SimStep['panel']) => visible.filter(s => s.panel === p)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-slate-400">{t.simKicker}<span data-testid="demo-badge" className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[0.625rem] tracking-[0.08em] text-amber-200">{t.demoBadge}</span></p>
          <h1 className="display mt-1.5 text-white">{scenario.title}</h1>
          <p className="mt-1 text-[0.875rem] text-slate-400">{scenario.subtitle}</p>
          <p className="mt-2 max-w-2xl text-[0.75rem] leading-relaxed text-slate-400">{t.simDemoNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label={t.mode} value={mode} onChange={setMode} options={[
            { value: 'vulnerable', label: 'Vulnerable', Icon: ShieldAlert, tone: 'danger' },
            { value: 'hardened', label: 'Hardened', Icon: ShieldCheck, tone: 'safe' }]} />
          <button onClick={stepOnce} disabled={shown >= steps.length} className="btn-ghost focus-ring" aria-label={t.step}><StepForward size={15} strokeWidth={1.8} /><span className="hidden sm:inline">{t.step}</span></button>
          <button onClick={reset} className="btn-ghost focus-ring" aria-label={t.reset} title={t.reset}><RotateCcw size={15} strokeWidth={1.8} /></button>
          <button onClick={run} data-testid="run" className="btn-primary focus-ring">
            <Play size={14} strokeWidth={2} className="text-red-600" aria-hidden />{status === 'running' ? t.running : shown ? t.rerun : t.run}
          </button>
        </div>
      </div>

      <div role="radiogroup" aria-label={t.scenarios} className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {scenarios.map((s, n) => {
          const on = s.id === sid
          return (
            <button key={s.id} role="radio" aria-checked={on} onClick={() => setSid(s.id)}
              className={`press focus-ring flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[0.75rem] ${on ? 'border-white/[0.14] bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgb(var(--white)/0.06)]' : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:text-slate-200'}`}>
              <span className={`font-mono text-[0.6875rem] tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>0{n + 1}</span>
              <span className="font-medium">{s.title}</span>
              <span aria-label={s.verification === 'verified' ? t.verified : t.illustrative} className={`h-1.5 w-1.5 rounded-full ${s.verification === 'verified' ? 'bg-emerald-400' : 'bg-amber-300'}`} />
            </button>)
        })}
      </div>

      <div data-testid="graph" className={`relative overflow-hidden rounded-[20px] border bg-white/[0.025] px-4 pb-3 pt-5 transition-[border-color,background-color] duration-200 ${compromised ? 'border-red-400/25' : hardenedWin ? 'border-emerald-400/25' : 'border-white/[0.07]'}`}>
        <KillChainGraph active={nodesFor(current)} reached={reached} compromised={compromised} hardened={hardenedWin} running={status === 'running'} />
        <div className="mt-4 flex items-center gap-3 border-t border-white/[0.05] pt-3 text-[0.6875rem] text-slate-400">
          <span className="font-mono tabular-nums"><span className="text-slate-200">{String(shown).padStart(2, '0')}</span> / {String(steps.length).padStart(2, '0')}</span>
          <div className="flex flex-1 gap-1" aria-hidden>
            {steps.map((st, i) => <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${i >= shown ? 'bg-white/[0.08]' : i === shown - 1 ? (st.blocked ? 'bg-emerald-400' : st.highlight || st.impact ? 'bg-amber-300' : 'bg-slate-200') : 'bg-white/30'}`} />)}
          </div>
          {impact && <span className={`flex items-center gap-1.5 font-medium ${compromised ? 'text-red-200' : 'text-emerald-200'}`}>{compromised ? <Siren size={13} strokeWidth={1.8} /> : <ShieldCheck size={13} strokeWidth={1.8} />}{impact.impact}</span>}
        </div>
      </div>

      <div className="grid gap-3 lg:h-[32.5rem] lg:grid-cols-[0.9fr_1.25fr_1fr]">
        <Panel title={t.pAgent} kicker="Agent View · IDE" Icon={MessageSquare} count={by('agent').length}>
          {!shown && <Empty text={t.emptyAgent} />}
          {by('agent').map(s => (
            <div key={s.i} className={`animate-fadein max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[0.8125rem] leading-relaxed ${s.role === 'user' ? 'ml-auto rounded-br-md border border-white/[0.08] bg-white/[0.07] text-slate-100' : 'rounded-bl-md bg-white/[0.035] text-slate-200'}`}>
              <div className="mb-0.5 text-[0.6875rem] font-medium text-slate-400">{s.role === 'user' ? t.you : t.assistant}</div>
              {s.content.replace(/\*\*/g, '')}
            </div>))}
        </Panel>
        <Panel title={t.pWire} kicker="JSON-RPC 2.0" Icon={Network} count={by('wire').length}>
          {!shown && <Empty text={t.emptyWire} />}
          {by('wire').map(s => (
            <div key={s.i} className={`animate-fadein rounded-xl border p-2.5 ${s.highlight ? 'border-red-400/25 bg-red-400/[0.05]' : s.blocked ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-white/[0.06] bg-black/20'}`}>
              <div className="mb-1.5 flex items-center gap-2 font-mono text-[0.6875rem] text-slate-400">
                <span>{s.role === 'client→server' ? '→ client ▸ server' : '← server ▸ client'}</span>
                {s.highlight && <Badge tone="danger" className="ml-auto">{t.injection}</Badge>}
                {s.blocked && <Badge tone="success" className="ml-auto">{t.blockedTag}</Badge>}
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[0.71875rem] leading-[1.6] text-slate-300"><Payload text={s.content} /></pre>
            </div>))}
        </Panel>
        <Panel chrome title={t.pHost} kicker="zsh — host" Icon={TerminalSquare} count={by('host').length}>
          {!shown && <Empty text={t.emptyHost} />}
          {by('host').map(s => (
            <pre key={s.i} className={`animate-fadein whitespace-pre-wrap break-words rounded-lg px-2.5 py-2 font-mono text-[0.71875rem] leading-[1.6] ${s.role === 'alert' ? (s.blocked ? 'border border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200' : 'border border-red-400/25 bg-red-400/[0.07] text-red-200') : 'text-slate-300'}`}><Payload text={s.content} /></pre>))}
          {status === 'running' && <span aria-hidden className="kc-caret ml-2.5 inline-block h-3.5 w-[7px] translate-y-0.5 bg-slate-300" />}
          {impact && <div role="status" className={`animate-fadein mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[0.875rem] font-semibold ${compromised ? 'bg-red-600 text-white' : 'bg-emerald-300 text-emerald-950'}`}>
            {compromised ? <Siren size={16} strokeWidth={2} /> : <ShieldCheck size={16} strokeWidth={2} />}{compromised ? `${t.impact}: ${impact.impact}` : t.cut}</div>}
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="card p-4 text-[0.875rem]">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            {scenario.verification === 'verified' ? <Badge tone="success">{t.verified}</Badge> : <Badge tone="warning">{t.illustrative}</Badge>}
            <span className="text-[0.75rem] text-slate-400">{scenario.threatClass}</span>
          </div>
          <p className="leading-relaxed text-slate-300">{scenario.sourceNote}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {scenario.references.map(r => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer noopener" className="focus-ring inline-flex items-center gap-1 rounded text-[0.75rem] text-cyan-300 hover:underline">{r.label}<ExternalLink size={11} aria-hidden /></a></li>)}
          </ul>
        </div>
        <div className="card p-4 text-[0.875rem]">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[0.8125rem] font-semibold text-slate-100"><ShieldCheck size={15} strokeWidth={1.8} className="text-emerald-300" aria-hidden />{t.howCut}</h3>
            <button onClick={() => onAudit(JSON.stringify(scenario.vulnerableConfig, null, 2))} className="press focus-ring inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[0.75rem] font-medium text-cyan-300 hover:bg-white/[0.05]">{t.auditThis}<ArrowRight size={13} aria-hidden /></button>
          </div>
          <ul className="space-y-1.5 text-slate-300">{scenario.mitigations.map(m => <li key={m} className="flex gap-2.5"><span aria-hidden className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />{m}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}

const Empty = ({ text }: { text: string }) => <p className="px-1 py-6 text-center text-[0.75rem] italic text-slate-400">{text}</p>
