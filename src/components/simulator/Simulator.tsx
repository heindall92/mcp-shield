import { useMemo, useState } from 'react'
import { Play, RotateCcw, StepForward, MessageSquare, Network, TerminalSquare, ShieldAlert, ShieldCheck, BadgeCheck, FlaskConical, ExternalLink, Siren } from 'lucide-react'
import { attackScenarios } from '../../data/attackScenarios'
import { stepsFor, nodesFor, type SimMode, type GraphNode } from '../../engine/simulation'
import { useKillChain } from './useKillChain'
import { KillChainGraph } from './KillChainGraph'
import { Panel } from './Panel'
import { Payload } from './Payload'
import type { SimStep } from '../../types/mcp.types'

export function Simulator({ onAudit }: { onAudit: (json: string) => void }) {
  const [sid, setSid] = useState(attackScenarios[0].id)
  const [mode, setMode] = useState<SimMode>('vulnerable')
  const scenario = attackScenarios.find(s => s.id === sid)!
  const steps = useMemo(() => stepsFor(scenario, mode), [scenario, mode])
  const { shown, status, run, reset, stepOnce, current } = useKillChain(steps)
  const visible = steps.slice(0, shown).map((s, i) => ({ ...s, i }))
  const reached = useMemo(() => new Set<GraphNode>(steps.slice(0, shown).flatMap(nodesFor)), [steps, shown])
  const impact = visible.find(s => s.impact)
  const compromised = !!impact && !impact.blocked
  const hardenedWin = !!impact?.blocked
  const by = (p: SimStep['panel']) => visible.filter(s => s.panel === p)

  return (
    <div className="space-y-4">
      {/* Scenario picker + controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-cyan-300/80">Simulador de Kill-Chain · 100% simulado</p>
          <h1 className="mt-1 text-balance display text-white">{scenario.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{scenario.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Modo" className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs font-medium">
            {(['vulnerable', 'hardened'] as const).map(m => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`press flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-[background-color,color,transform] duration-150 ${mode === m ? (m === 'vulnerable' ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-200') : 'text-slate-400 hover:text-slate-200'}`}>
                {m === 'vulnerable' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}{m === 'vulnerable' ? 'Vulnerable' : 'Hardened'}
              </button>))}
          </div>
          <button onClick={stepOnce} disabled={shown >= steps.length} className="btn-ghost" aria-label="Paso a paso"><StepForward size={15} /><span className="hidden sm:inline">Paso</span></button>
          <button onClick={reset} className="btn-ghost" aria-label="Reiniciar"><RotateCcw size={15} /></button>
          <button onClick={run} data-testid="run" className={`btn-primary ${status === 'idle' && shown === 0 ? 'animate-pulseGlow' : ''}`}>
            <Play size={16} fill="currentColor" />{status === 'running' ? 'Ejecutando…' : shown ? 'Repetir simulación' : 'Ejecutar simulación de ataque'}
          </button>
        </div>
      </div>

      <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {attackScenarios.map((s, n) => (
          <button key={s.id} onClick={() => setSid(s.id)} aria-pressed={s.id === sid}
            className={`press group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-[background-color,border-color,transform] duration-150 ${s.id === sid ? 'border-cyan-400/50 bg-cyan-400/10 text-white' : 'border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
            <span className="font-mono text-[0.625rem] text-slate-500">0{n + 1}</span>
            <span className="font-medium">{s.title}</span>
            {s.verification === 'verified' ? <BadgeCheck size={13} className="text-emerald-400" aria-label="Caso real verificado" /> : <FlaskConical size={13} className="text-amber-300" aria-label="Escenario ilustrativo" />}
          </button>))}
      </div>

      {/* Glowing graph */}
      <div className={`relative overflow-hidden rounded-2xl border px-3 pt-4 transition-colors duration-200 ${compromised ? 'border-red-500/40 bg-red-950/20' : hardenedWin ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-white/[0.07] bg-white/[0.02]'}`}>
        <KillChainGraph active={nodesFor(current)} reached={reached} compromised={compromised} hardened={hardenedWin} />
        <div className="flex items-center justify-between gap-3 border-t border-white/5 py-2 text-[0.6875rem] text-slate-500">
          <span className="font-mono">step {shown}/{steps.length}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5"><div className={`h-full origin-left rounded-full transition-transform duration-200 ease-out ${mode === 'hardened' ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-400 to-red-500'}`} style={{ transform: `scaleX(${steps.length ? shown / steps.length : 0})` }} /></div>
          {impact && <span className={`flex items-center gap-1 font-semibold ${compromised ? 'text-red-300' : 'text-emerald-300'}`}>{compromised ? <Siren size={13} /> : <ShieldCheck size={13} />}{impact.impact}</span>}
        </div>
      </div>

      {/* 3 columns */}
      <div className="grid gap-3 lg:h-[520px] lg:grid-cols-[0.9fr_1.25fr_1fr]">
        <Panel title="Lo que ve el usuario" kicker="Agent View · IDE" Icon={MessageSquare} tone="slate" count={by('agent').length}>
          {!shown && <Empty text="Pulsa “Ejecutar” y mira cómo un chat totalmente normal…" />}
          {by('agent').map(s => (
            <div key={s.i} className={`animate-fadein max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[0.8125rem] leading-relaxed ${s.role === 'user' ? 'ml-auto rounded-br-md bg-cyan-500/15 text-cyan-50' : 'rounded-bl-md bg-white/[0.05] text-slate-200'}`}>
              <div className="mb-0.5 text-[0.625rem] uppercase tracking-wider text-slate-500">{s.role === 'user' ? 'Tú' : 'Asistente'}</div>
              {s.content.replace(/\*\*/g, '')}
            </div>))}
        </Panel>
        <Panel title="Lo que recibe el modelo" kicker="JSON-RPC 2.0 Wire" Icon={Network} tone="cyan" count={by('wire').length}>
          {!shown && <Empty text="…esconde un payload que el usuario nunca ve." />}
          {by('wire').map(s => (
            <div key={s.i} className={`animate-fadein rounded-xl border p-2.5 ${s.highlight ? 'border-red-500/40 bg-red-500/[0.06]' : s.blocked ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-white/[0.06] bg-black/30'}`}>
              <div className="mb-1.5 flex items-center gap-2 font-mono text-[0.625rem]">
                <span className={s.role === 'client→server' ? 'text-cyan-300' : 'text-violet-300'}>{s.role === 'client→server' ? '→ client ▸ server' : '← server ▸ client'}</span>
                {s.highlight && <span className="ml-auto rounded bg-red-500/20 px-1.5 py-0.5 font-semibold text-red-300">INYECCIÓN</span>}
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[0.71875rem] leading-[1.55] text-slate-300"><Payload text={s.content} /></pre>
            </div>))}
        </Panel>
        <Panel title="Impacto en el host" kicker="OS Console" Icon={TerminalSquare} tone="red" count={by('host').length}>
          {!shown && <Empty text="…y lo que pasa de verdad en tu máquina." />}
          {by('host').map(s => (
            <pre key={s.i} className={`animate-fadein whitespace-pre-wrap break-words rounded-lg px-2.5 py-2 font-mono text-[0.71875rem] leading-[1.55] ${s.role === 'alert' ? (s.blocked ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40' : 'bg-red-500/15 text-red-200 ring-1 ring-red-500/50 shadow-[0_0_30px_-6px_#ef4444]') : 'text-emerald-200/80'}`}><Payload text={s.content} /></pre>))}
          {impact && <div className={`animate-fadein mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${compromised ? 'bg-red-500 text-white shadow-[0_0_40px_-4px_#ef4444]' : 'bg-emerald-500 text-emerald-950'}`}>
            {compromised ? <Siren size={16} /> : <ShieldCheck size={16} />}{compromised ? `IMPACTO: ${impact.impact}` : 'Kill-chain cortada por la config endurecida'}</div>}
        </Panel>
      </div>

      {/* Context, sources, mitigations */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            {scenario.verification === 'verified'
              ? <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300"><BadgeCheck size={13} />Caso real verificado</span>
              : <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200"><FlaskConical size={13} />Escenario ilustrativo</span>}
            <span className="text-slate-500">{scenario.threatClass}</span>
          </div>
          <p className="leading-relaxed text-slate-300">{scenario.sourceNote}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {scenario.references.map(r => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline">{r.label}<ExternalLink size={11} /></a></li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><ShieldCheck size={14} />Cómo se corta esta cadena</h3>
            <button onClick={() => onAudit(JSON.stringify(scenario.vulnerableConfig, null, 2))} className="text-xs font-medium text-cyan-300 hover:underline">Auditar esta config →</button>
          </div>
          <ul className="space-y-1.5 text-slate-300">{scenario.mitigations.map(m => <li key={m} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />{m}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}

const Empty = ({ text }: { text: string }) => <p className="px-1 py-6 text-center text-xs italic text-slate-600">{text}</p>
