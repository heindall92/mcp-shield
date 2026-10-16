import { useMemo, useRef, useState } from 'react'
import { FileJson, Upload, FileDown, FileCode2, Container, AlertTriangle, CheckCircle2, Lock, Copy, Check } from 'lucide-react'
import { scanText, parseConfig } from '../../engine/scanner'
import { remediate, removedServers, dockerSnippet } from '../../engine/remediator'
import { toSarif, toMarkdown, download } from '../../engine/sarifExporter'
import { sampleConfigs } from '../../data/sampleConfigs'
import { FindingCard } from './FindingCard'
import { DiffView } from './DiffView'
import { ScoreRing } from './ScoreRing'
import { usePrefs } from '../../i18n/prefs'
import { Segmented } from '../ui/Segmented'

export function Auditor({ text, setText }: { text: string; setText: (t: string) => void }) {
  const { t, lang } = usePrefs()
  const [view, setView] = useState<'diff' | 'hardened' | 'docker'>('diff')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const res = useMemo(() => scanText(text, lang), [text, lang])
  const cfg = useMemo(() => parseConfig(text, lang).config, [text, lang])
  const hardened = useMemo(() => (cfg ? JSON.stringify(remediate(cfg), null, 2) : ''), [cfg])
  const removed = useMemo(() => (cfg ? removedServers(cfg) : []), [cfg])
  const docker = useMemo(() => (cfg ? dockerSnippet(cfg, lang) : ''), [cfg, lang])
  const pretty = useMemo(() => (cfg ? JSON.stringify(cfg, null, 2) : text), [cfg, text])

  const onFile = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result)); r.readAsText(f) }
  const copy = async () => { await navigator.clipboard?.writeText(view === 'docker' ? docker : hardened); setCopied(true); setTimeout(() => setCopied(false), 1400) }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-slate-400">{t.audKicker}</p>
        <h1 className="display mt-1.5 text-white">{t.audTitle}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400"><Lock size={13} className="text-emerald-400" />{t.audPrivacy}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {sampleConfigs.map(s => (
          <button key={s.id} onClick={() => setText(JSON.stringify(s.config, null, 2))} className="btn-chip focus-ring">
            {s.id === 'hardened' ? <CheckCircle2 size={13} strokeWidth={1.8} className="text-emerald-400" aria-hidden /> : <AlertTriangle size={13} strokeWidth={1.8} className="text-amber-300" aria-hidden />}{lang === 'en' ? s.labelEn : s.label}
          </button>))}
        <button onClick={() => fileRef.current?.click()} className="btn-chip focus-ring"><Upload size={13} strokeWidth={1.8} aria-hidden />{t.openFile}</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <section className="flex flex-col overflow-hidden rounded-[18px] border border-white/[0.07] bg-surface shadow-[inset_0_1px_0_rgb(var(--white)/0.04)]">
          <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5 text-[0.8125rem] font-semibold"><FileJson size={15} className="text-cyan-300" />mcp.json / claude_desktop_config.json</header>
          <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false} aria-label={t.editor}
            className="scroll-thin min-h-[320px] flex-1 resize-y bg-transparent p-4 font-mono text-[0.75rem] leading-[1.6] text-slate-200 outline-none lg:min-h-[440px]" />
          {res.parseError && <p className="border-t border-red-400/25 bg-red-400/[0.07] px-4 py-2 text-[0.75rem] text-red-200">{t.invalidJson}: {res.parseError}</p>}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-4 card p-4">
            <ScoreRing score={res.riskScore} grade={res.grade} label={t.score(res.riskScore, res.grade)} gradeWord={t.grade} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{res.findings.length ? t.findingsIn(res.findings.length, res.serversScanned) : res.parseError ? t.waiting : t.clean}</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[0.6875rem] font-medium">
                {(['critical', 'high', 'medium', 'low'] as const).map(k => <span key={k} className={`sev-${k} rounded-md px-1.5 py-0.5`}>{k} {res.counts[k]}</span>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!!res.parseError} onClick={() => download('mcp-shield.sarif', JSON.stringify(toSarif(res, 'mcp.json', lang), null, 2), 'application/sarif+json')} className="btn-ghost focus-ring text-[0.75rem]"><FileCode2 size={14} />SARIF</button>
                <button disabled={!!res.parseError} onClick={() => download('mcp-shield-report.md', toMarkdown(res, lang), 'text/markdown')} className="btn-ghost focus-ring text-[0.75rem]"><FileDown size={14} />Markdown</button>
                <button disabled={!cfg} onClick={() => download('mcp.hardened.json', hardened, 'application/json')} className="btn-ghost focus-ring text-[0.75rem]"><FileJson size={14} />{t.hardenedJson}</button>
                <button disabled={!cfg} onClick={() => download('Dockerfile.mcp-sandbox', docker, 'text/plain')} className="btn-ghost focus-ring text-[0.75rem]"><Container size={14} />Docker</button>
              </div>
            </div>
          </div>
          <div data-testid="findings" className="scroll-thin max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {res.findings.map(f => <FindingCard key={f.id} f={f} />)}
          </div>
        </section>
      </div>

      {cfg && <section className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-surface shadow-[inset_0_1px_0_rgb(var(--white)/0.04)]">
        <header className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
          <Segmented size="sm" label={t.diffTab} value={view} onChange={setView} options={[{ value: 'diff', label: t.diffTab }, { value: 'hardened', label: t.fixedTab }, { value: 'docker', label: t.dockerTab }]} />
          <button onClick={copy} className="press ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white">{copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{copied ? t.copied : t.copy}</button>
        </header>
        {removed.length > 0 && <p className="border-b border-red-400/20 bg-red-400/[0.06] px-4 py-2 text-[0.75rem] text-red-200">{t.removed}: <b>{removed.join(', ')}</b></p>}
        {view === 'diff' ? <DiffView before={pretty} after={hardened} />
          : <pre className="scroll-thin max-h-[460px] overflow-auto p-4 font-mono text-[0.75rem] leading-[1.6] text-slate-200">{view === 'docker' ? docker : hardened}</pre>}
        <p className="border-t border-white/[0.05] px-4 py-2 text-[0.6875rem] text-slate-400">{t.pinNote}</p>
      </section>}
    </div>
  )
}
