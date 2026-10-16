import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { FileJson, Upload, FileDown, FileCode2, Container, Lock, Copy, Check, RotateCcw, FlaskConical, Info, ClipboardPaste, Printer, X, Sparkles, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { scanText, scanConfig, parseConfig } from '../../engine/scanner'
import { hardeningVerdict, removedServers, dockerSnippet } from '../../engine/remediator'
import { gate } from '../../engine/exportGate'
import { mergeTools } from '../../engine/toolsImport'
import type { McpToolDefinition } from '../../types/mcp.types'
import { CoveragePanel } from './CoveragePanel'
import { ToolsImport } from './ToolsImport'
import { toSarif, toMarkdown, download } from '../../engine/sarifExporter'
import { redactValue } from '../../engine/redact'
import { visible } from '../../engine/rules/smugglingRules'
import { MAX_INPUT_BYTES } from '../../engine/parse'
import { sampleConfigs } from '../../data/sampleConfigs'
import { FindingCard } from './FindingCard'
import { DiffView } from './DiffView'
import { ScoreRing } from './ScoreRing'
import { usePrefs } from '../../i18n/prefs'
import { Segmented } from '../ui/Segmented'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useToast } from '../ui/toast'
import { OPEN_FILE_EVENT, VERSION } from '../../meta'

const OB_KEY = 'mcps-onboarded'
const seenOnboarding = () => { try { return localStorage.getItem(OB_KEY) === '1' } catch { return true } }

export function Auditor({ text, setText, onReset, onLoadDemo }: { text: string; setText: (t: string) => void; onReset: () => void; onLoadDemo: (id: string) => void }) {
  const { t, lang } = usePrefs()
  const toast = useToast()
  const [onboard, setOnboard] = useState(() => !seenOnboarding())
  const dismissOnboard = () => { setOnboard(false); try { localStorage.setItem(OB_KEY, '1') } catch { /* private mode */ } }
  const [view, setView] = useState<'diff' | 'hardened' | 'docker'>('diff')
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [drag, setDrag] = useState(false)
  const [fileErr, setFileErr] = useState('')
  const [fileName, setFileName] = useState('mcp.json')
  const fileRef = useRef<HTMLInputElement>(null)
  const copyTimer = useRef<number | undefined>(undefined)
  const [printedAt, setPrintedAt] = useState('')
  useEffect(() => { const h = () => setPrintedAt(new Date().toLocaleString(lang)); addEventListener('beforeprint', h); return () => removeEventListener('beforeprint', h) }, [lang])
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])
  useEffect(() => { const h = () => fileRef.current?.click(); addEventListener(OPEN_FILE_EVENT, h); return () => removeEventListener(OPEN_FILE_EVENT, h) }, [])

  // Large pastes stay responsive: analysis runs on a deferred copy of the text.
  const input = useDeferredValue(text)
  const empty = input.trim() === ''
  const [inv, setInv] = useState<Record<string, McpToolDefinition[]>>({})
  const parsed = useMemo(() => (empty ? undefined : parseConfig(input, lang)), [input, lang, empty])
  const cfg = useMemo(() => (parsed?.config ? mergeTools(parsed.config, inv) : undefined), [parsed, inv])
  const res = useMemo(() => (empty ? null : cfg ? { ...scanConfig(cfg, lang), warnings: parsed?.warnings } : scanText(input, lang)), [input, lang, empty, cfg, parsed])
  const verdict = useMemo(() => (cfg ? hardeningVerdict(cfg, lang) : undefined), [cfg, lang])
  const hardened = useMemo(() => (verdict ? JSON.stringify(verdict.config, null, 2) : ''), [verdict])
  const removed = useMemo(() => (cfg ? removedServers(cfg) : []), [cfg])
  const docker = useMemo(() => (cfg ? dockerSnippet(cfg, lang) : ''), [cfg, lang])
  // The "before" view never renders raw secrets.
  const pretty = useMemo(() => (cfg ? visible(JSON.stringify(redactValue(cfg), null, 2), Infinity) : ''), [cfg])
  const hasRedaction = pretty.includes('[REDACTED]')
  // Final output gate: every export is re-checked for anything secret-shaped before it can leave the page.
  const outputs = useMemo(() => (res && !res.parseError && cfg ? {
    sarif: JSON.stringify(toSarif(res, fileName, lang, input), null, 2), md: toMarkdown(res, lang), fixed: hardened, docker,
  } : undefined), [res, cfg, fileName, lang, input, hardened, docker])
  const gates = useMemo(() => (outputs ? { sarif: gate(outputs.sarif), md: gate(outputs.md), fixed: gate(outputs.fixed), docker: gate(outputs.docker) } : undefined), [outputs])
  const blocked = gates ? [...new Set(Object.values(gates).flatMap(g => g.hits.map(h => h.kind)))] : []

  const onFile = (f?: File | null) => {
    setFileErr('')
    if (!f) return
    if (f.size > MAX_INPUT_BYTES) { setFileErr(t.fileTooBig); return }
    const r = new FileReader()
    r.onload = () => { setFileName(f.name || 'mcp.json'); setText(String(r.result ?? '')) }
    r.onerror = () => setFileErr(t.fileRead)
    r.readAsText(f)
  }
  const copy = async () => {
    const out = view === 'docker' ? docker : hardened
    const g = gate(out)
    if (!g.ok) { toast(t.gateBlocked([...new Set(g.hits.map(h => h.kind))].join(', ')), 'error'); return }
    try { await navigator.clipboard.writeText(out) } catch { toast(t.toastCopyFail, 'error'); return }
    toast(t.toastCopied); setCopied(true); window.clearTimeout(copyTimer.current); copyTimer.current = window.setTimeout(() => setCopied(false), 1400)
  }
  const loadDemo = (id: string) => { setFileName('demo-mcp.json'); onLoadDemo(id) }
  const save = (name: string, content: string, mime: string) => {
    const g = gate(content)
    if (!g.ok) { toast(t.gateBlocked([...new Set(g.hits.map(h => h.kind))].join(', ')), 'error'); return }
    download(name, content, mime); toast(t.toastDownloaded(name))
  }
  const doReset = () => { setInv({}); setFileName('mcp.json'); setFileErr(''); setView('diff'); if (fileRef.current) fileRef.current.value = ''; onReset() }
  const disabled = !res || !!res.parseError

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-slate-400">{t.audKicker}</p>
        <h1 className="display mt-1.5 text-white">{t.audTitle}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400"><Lock size={13} className="text-emerald-400" aria-hidden />{t.audPrivacy}</p>
      </div>
      <div className="print-only">
        <h1 className="text-xl font-semibold">{t.printTitle}</h1>
        <p className="text-sm">{t.printDate}: {printedAt} · {fileName} · MCP-Shield v{VERSION}</p>
        <p className="text-sm">{t.printNote}</p>
      </div>
      {onboard && <section data-testid="onboarding" aria-labelledby="ob-title" className="card no-print flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-slate-200"><Sparkles size={15} strokeWidth={1.8} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="ob-title" className="text-[0.9375rem] font-semibold text-white">{t.obTitle}</h2>
          <ol className="mt-2 grid gap-2 text-[0.8125rem] leading-relaxed text-slate-300 md:grid-cols-3">{t.obSteps.map((x, i) => <li key={x} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[0.6875rem] font-semibold text-white">{i + 1}</span>{x}</li>)}</ol>
        </div>
        <button onClick={dismissOnboard} className="btn-ghost focus-ring shrink-0 text-[0.75rem]"><X size={13} aria-hidden />{t.obDismiss}</button>
      </section>}
      <div className="no-print flex flex-wrap items-center gap-2">
        <button onClick={() => fileRef.current?.click()} className="btn-primary focus-ring text-[0.8125rem]"><Upload size={14} strokeWidth={1.8} aria-hidden />{t.openFile}</button>
        <input ref={fileRef} type="file" accept=".json,.jsonc,application/json" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        <label className="btn-chip focus-within:ring-2 focus-within:ring-slate-400/60">
          <FlaskConical size={13} strokeWidth={1.8} className="text-slate-400" aria-hidden />
          <span className="sr-only">{t.loadDemo}</span>
          <select data-testid="demo-select" value="" onChange={e => loadDemo(e.target.value)} className="cursor-pointer bg-transparent text-[0.75rem] outline-none">
            <option value="" disabled>{t.loadDemo}</option>
            {sampleConfigs.map(s => <option key={s.id} value={s.id} className="bg-elevated text-slate-200">{lang === 'en' ? s.labelEn : s.label}</option>)}
          </select>
        </label>
        <button disabled={disabled} onClick={() => print()} className="btn-chip focus-ring ml-auto disabled:opacity-40"><Printer size={13} strokeWidth={1.8} aria-hidden />{t.print}</button>
        <button disabled={!text} onClick={() => setConfirm(true)} className="btn-chip focus-ring disabled:opacity-40"><RotateCcw size={13} strokeWidth={1.8} aria-hidden />{t.resetBtn}</button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section data-testid="editor-pane" onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]) }}
          className={`no-print relative flex flex-col overflow-hidden rounded-[18px] border bg-surface shadow-[inset_0_1px_0_rgb(var(--white)/0.04)] transition-colors ${drag ? 'border-emerald-400/60' : 'border-white/[0.07]'}`}>
          <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5 text-[0.8125rem] font-semibold"><FileJson size={15} className="text-cyan-300" aria-hidden />mcp.json / claude_desktop_config.json</header>
          <textarea data-testid="editor" value={text} onChange={e => setText(e.target.value)} spellCheck={false} autoComplete="off" aria-label={t.editor} placeholder={t.placeholder}
            className="scroll-thin min-h-[320px] flex-1 resize-y bg-transparent p-4 font-mono text-[0.75rem] leading-[1.6] text-slate-200 outline-none placeholder:text-slate-500 lg:min-h-[440px]" />
          {drag && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-canvas/80 text-sm font-medium text-white">{t.dropHere}</div>}
          {(fileErr || res?.parseError) && <p role="alert" className="border-t border-red-400/25 bg-red-400/[0.07] px-4 py-2 text-[0.75rem] text-red-200">{fileErr || `${t.invalidJson}: ${res?.parseError}`}</p>}
          {!!res?.warnings?.length && <div className="border-t border-amber-300/20 bg-amber-300/[0.06] px-4 py-2 text-[0.75rem] text-amber-100">
            <b>{t.parseWarnings}:</b><ul className="mt-1 list-disc space-y-0.5 pl-4">{res.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
        </section>

        <section className="flex flex-col gap-3">
          {!res ? (
            <div data-testid="empty-state" className="card flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-slate-300"><ClipboardPaste size={20} strokeWidth={1.6} aria-hidden /></span>
              <h2 className="text-[1.0625rem] font-semibold text-white">{t.emptyTitle}</h2>
              <p className="max-w-md text-sm leading-relaxed text-slate-400">{t.emptyBody}</p>
            </div>
          ) : <>
            <div className="flex items-center gap-4 card p-4">
              <ScoreRing score={res.riskScore} grade={res.grade} label={t.score(res.riskScore, res.grade)} gradeWord={t.grade} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white" aria-live="polite">{res.findings.length ? t.findingsIn(res.findings.length, res.serversScanned) : res.parseError ? t.waiting : !res.complete ? t.notClean : t.clean}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[0.6875rem] font-medium">
                  {(['critical', 'high', 'medium', 'low'] as const).map(k => <span key={k} className={`sev-${k} rounded-md px-1.5 py-0.5`}>{k} {res.counts[k]}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={disabled || !gates?.sarif.ok} onClick={() => outputs && save('mcp-shield.sarif', outputs.sarif, 'application/sarif+json')} className="btn-ghost focus-ring text-[0.75rem]"><FileCode2 size={14} aria-hidden />SARIF</button>
                  <button disabled={disabled || !gates?.md.ok} onClick={() => outputs && save('mcp-shield-report.md', outputs.md, 'text/markdown')} className="btn-ghost focus-ring text-[0.75rem]"><FileDown size={14} aria-hidden />Markdown</button>
                  <button disabled={!cfg || !gates?.fixed.ok} onClick={() => save('mcp.hardened.json', hardened, 'application/json')} className="btn-ghost focus-ring text-[0.75rem]"><FileJson size={14} aria-hidden />{t.hardenedJson}</button>
                  <button disabled={!cfg || !gates?.docker.ok} onClick={() => save('Dockerfile.mcp-sandbox', docker, 'text/plain')} className="btn-ghost focus-ring text-[0.75rem]"><Container size={14} aria-hidden />Docker</button>
                </div>
              </div>
            </div>
 {blocked.length > 0 && <p role="alert" data-testid="gate-blocked" className="rounded-lg border border-red-400/25 bg-red-400/[0.07] px-3 py-2 text-[0.75rem] text-red-200"><b>{t.gateTitle}:</b> {t.gateBlocked(blocked.join(', '))}</p>}
            <div data-testid="findings" className="scroll-thin max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {res.findings.map(f => <FindingCard key={f.id} f={f} />)}
            </div>
            <CoveragePanel res={res} />
            {cfg && <ToolsImport servers={Object.keys(cfg.mcpServers)} imported={Object.fromEntries(Object.entries(inv).filter(([k]) => k in cfg.mcpServers))}
              onImport={(sv, tools) => setInv(p => ({ ...p, [sv]: tools }))} onRemove={sv => setInv(p => { const n = { ...p }; delete n[sv]; return n })} />}
          </>}
        </section>
      </div>

      {cfg && <section className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-surface shadow-[inset_0_1px_0_rgb(var(--white)/0.04)]">
        <header className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
          <Segmented size="sm" label={t.diffTab} value={view} onChange={setView} options={[{ value: 'diff', label: t.diffTab }, { value: 'hardened', label: t.fixedTab }, { value: 'docker', label: t.dockerTab }]} />
          <button onClick={copy} className="press focus-ring ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white">{copied ? <Check size={13} className="text-emerald-400" aria-hidden /> : <Copy size={13} aria-hidden />}{copied ? t.copied : t.copy}</button>
        </header>
        {verdict && <div data-testid="hardening-status" data-status={verdict.status} role="status" className={`border-b px-4 py-2.5 text-[0.75rem] ${verdict.status === 'hardened' ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100' : 'border-amber-300/25 bg-amber-300/[0.07] text-amber-100'}`}>
          <p className="flex items-center gap-1.5 font-medium">{verdict.status === 'hardened' ? <ShieldCheck size={14} aria-hidden /> : <ShieldAlert size={14} aria-hidden />}{verdict.status === 'hardened' ? t.hvHardened : t.hvPartial(verdict.remaining.length)}</p>
          {verdict.remaining.length > 0 && <ul className="mt-1.5 space-y-0.5 pl-5">{verdict.remaining.slice(0, 8).map(f => <li key={f.id} className="flex gap-1.5"><ShieldX size={12} className="mt-0.5 shrink-0" aria-hidden /><span><code>{f.ruleId}</code> · {f.server}: {f.title}</span></li>)}</ul>}
          {verdict.notes.some(n => n.kind === 'network') && <p className="mt-1.5 pl-5">{t.hvNetwork}</p>}
          {verdict.notes.some(n => n.kind === 'dropped') && <p className="mt-1.5 pl-5">{t.hvDropped}: <code className="break-all">{[...new Set(verdict.notes.filter(n => n.kind === 'dropped').map(n => n.flag))].join(' · ')}</code></p>}
        </div>}
        {removed.length > 0 && <p className="border-b border-red-400/20 bg-red-400/[0.06] px-4 py-2 text-[0.75rem] text-red-200">{t.removed}: <b>{removed.join(', ')}</b></p>}
        {hasRedaction && <p className="flex items-center gap-1.5 border-b border-white/[0.05] px-4 py-2 text-[0.75rem] text-slate-300"><Info size={13} aria-hidden />{t.redactedNote}</p>}
        {view === 'diff' ? <DiffView before={pretty} after={hardened} />
          : <pre tabIndex={0} className="focus-ring scroll-thin max-h-[460px] overflow-auto p-4 font-mono text-[0.75rem] leading-[1.6] text-slate-200">{view === 'docker' ? docker : hardened}</pre>}
        <p className="border-t border-white/[0.05] px-4 py-2 text-[0.6875rem] text-slate-400">{t.pinNote}</p>
      </section>}
      <ConfirmDialog open={confirm} title={t.resetTitle} body={t.resetBody} confirm={t.resetConfirm} cancel={t.cancel} onConfirm={doReset} onClose={() => setConfirm(false)} />
    </div>
  )
}
