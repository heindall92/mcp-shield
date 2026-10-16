import { useMemo, useRef, useState } from 'react'
import { FileJson, Upload, FileDown, FileCode2, Container, AlertTriangle, CheckCircle2, Lock, Copy, Check } from 'lucide-react'
import { scanText, parseConfig } from '../../engine/scanner'
import { remediate, removedServers, dockerSnippet } from '../../engine/remediator'
import { toSarif, toMarkdown, download } from '../../engine/sarifExporter'
import { sampleConfigs } from '../../data/sampleConfigs'
import { FindingCard } from './FindingCard'
import { DiffView } from './DiffView'
import { ScoreRing } from './ScoreRing'

export function Auditor({ text, setText }: { text: string; setText: (t: string) => void }) {
  const [view, setView] = useState<'diff' | 'hardened' | 'docker'>('diff')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const res = useMemo(() => scanText(text), [text])
  const cfg = useMemo(() => parseConfig(text).config, [text])
  const hardened = useMemo(() => (cfg ? JSON.stringify(remediate(cfg), null, 2) : ''), [cfg])
  const removed = useMemo(() => (cfg ? removedServers(cfg) : []), [cfg])
  const docker = useMemo(() => (cfg ? dockerSnippet(cfg) : ''), [cfg])
  const pretty = useMemo(() => (cfg ? JSON.stringify(cfg, null, 2) : text), [cfg, text])

  const onFile = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result)); r.readAsText(f) }
  const copy = async () => { await navigator.clipboard?.writeText(view === 'docker' ? docker : hardened); setCopied(true); setTimeout(() => setCopied(false), 1400) }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-300/80">Pruébalo con tu propio archivo</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">Auditor de mcp.json</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400"><Lock size={13} className="text-emerald-400" />Se analiza en la memoria de tu navegador. Nada se sube a ningún servidor.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {sampleConfigs.map(s => (
          <button key={s.id} onClick={() => setText(JSON.stringify(s.config, null, 2))} className="btn-chip">
            {s.id === 'hardened' ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertTriangle size={13} className="text-amber-300" />}{s.label}
          </button>))}
        <button onClick={() => fileRef.current?.click()} className="btn-chip"><Upload size={13} />Abrir archivo local</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0f16]">
          <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5 text-[13px] font-semibold"><FileJson size={15} className="text-cyan-300" />mcp.json / claude_desktop_config.json</header>
          <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false} aria-label="Editor de mcp.json"
            className="scroll-thin min-h-[320px] flex-1 resize-y bg-transparent p-4 font-mono text-[12px] leading-[1.6] text-slate-200 outline-none lg:min-h-[440px]" />
          {res.parseError && <p className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">JSON no válido: {res.parseError}</p>}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <ScoreRing score={res.riskScore} grade={res.grade} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{res.findings.length ? `${res.findings.length} hallazgos en ${res.serversScanned} servidores` : res.parseError ? 'Esperando JSON válido' : 'Sin hallazgos 🎉'}</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                {(['critical', 'high', 'medium', 'low'] as const).map(k => <span key={k} className={`sev-${k} rounded-md px-1.5 py-0.5`}>{k} {res.counts[k]}</span>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!!res.parseError} onClick={() => download('mcp-shield.sarif', JSON.stringify(toSarif(res), null, 2), 'application/sarif+json')} className="btn-ghost text-xs"><FileCode2 size={14} />SARIF</button>
                <button disabled={!!res.parseError} onClick={() => download('mcp-shield-report.md', toMarkdown(res), 'text/markdown')} className="btn-ghost text-xs"><FileDown size={14} />Markdown</button>
                <button disabled={!cfg} onClick={() => download('mcp.hardened.json', hardened, 'application/json')} className="btn-ghost text-xs"><FileJson size={14} />mcp.json endurecido</button>
                <button disabled={!cfg} onClick={() => download('Dockerfile.mcp-sandbox', docker, 'text/plain')} className="btn-ghost text-xs"><Container size={14} />Docker</button>
              </div>
            </div>
          </div>
          <div data-testid="findings" className="scroll-thin max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {res.findings.map(f => <FindingCard key={f.id} f={f} />)}
          </div>
        </section>
      </div>

      {cfg && <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0f16]">
        <header className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
          {([['diff', 'Vulnerable vs Hardened'], ['hardened', 'mcp.json corregido'], ['docker', 'Sandbox Docker']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${view === k ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>))}
          <button onClick={copy} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white">{copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{copied ? 'Copiado' : 'Copiar'}</button>
        </header>
        {removed.length > 0 && <p className="border-b border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-xs text-red-200">Servidores eliminados por Tool Poisoning: <b>{removed.join(', ')}</b></p>}
        {view === 'diff' ? <DiffView before={pretty} after={hardened} />
          : <pre className="scroll-thin max-h-[460px] overflow-auto p-4 font-mono text-[12px] leading-[1.6] text-emerald-100/90">{view === 'docker' ? docker : hardened}</pre>}
        <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">Las versiones <code>@1.0.0</code> son marcadores: sustitúyelas por la versión que hayas auditado. Las imágenes <code>mcp-sandbox/*</code> se construyen con el Dockerfile generado.</p>
      </section>}
    </div>
  )
}
