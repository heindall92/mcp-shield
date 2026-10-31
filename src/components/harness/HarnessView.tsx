import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { Upload, FlaskConical, Trash2, Lock, FileText, FileCode2, FileJson, X, Download, Info, ShieldCheck, ClipboardPaste, ChevronDown, TriangleAlert, Plus } from 'lucide-react'
import type { Severity } from '../../types/mcp.types'
import type { HarnessFile, HarnessKind } from '../../harness/types'
import { usePrefs } from '../../i18n/prefs'
import { hsStrings } from '../../i18n/harness'
import { useToast } from '../ui/toast'
import { Badge } from '../ui/Badge'
import { RiskMeter } from '../auditor/RiskMeter'
import { HarnessFindingCard } from './HarnessFindingCard'
import { scanHarness } from '../../harness/scan'
import { HS_RULES, isoLabel } from '../../harness/rules'
import { HARNESS_SAMPLES } from '../../harness/samples'
import { readHarnessFile, detectKind, byteLength, HS_MAX_BYTES, HS_MAX_FILES } from '../../harness/intake'
import type { HarnessState } from './state'
import { exportHarnessSarif, exportHarnessMarkdown } from '../../harness/exporter'
import { download } from '../../engine/sarifExporter'
import { safeText } from '../../engine/redact'


const SEVS: Severity[] = ['critical', 'high', 'medium', 'low']
const KIND_ICON = (k: HarnessKind) => (k === 'bash' || k === 'python' || k === 'powershell' ? FileCode2 : k === 'mcp' || k === 'json' ? FileJson : FileText)
const ACCEPT = '.md,.mdc,.markdown,.txt,.json,.jsonc,.sh,.bash,.zsh,.py,.ps1,.psm1,.toml,.yaml,.yml,.cursorrules,.windsurfrules,.clinerules,text/*,application/json'

/**
 * Harness-Shield view. Files live in memory only (App state, cleared by Reset); every string that comes from a
 * file is rendered as text, never as HTML. Size is checked from File.size before any read.
 */
export function HarnessView({ state, setState }: { state: HarnessState; setState: (s: HarnessState | ((p: HarnessState) => HarnessState)) => void }) {
  const { lang, t } = usePrefs()
  const s = hsStrings(lang)
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [sev, setSev] = useState<Severity | 'all'>('all')
  const [pasteName, setPasteName] = useState('CLAUDE.md')
  const [pasteBody, setPasteBody] = useState('')
  const files = useDeferredValue(state.files)
  const res = useMemo(() => (files.length ? scanHarness(files, lang) : undefined), [files, lang])
  const shown = useMemo(() => (res?.findings ?? []).filter(f => sev === 'all' || f.severity === sev), [res, sev])
  const truncated = res?.files.reduce((n, f) => n + f.truncatedLines, 0) ?? 0

  const merge = (add: HarnessFile[], rejected: HarnessState['rejected']) => setState(p => {
    const byName = new Map(p.files.map(f => [f.name, f]))
    for (const f of add) byName.set(f.name, f)
    return { files: [...byName.values()].slice(0, HS_MAX_FILES), rejected }
  })

  const addFiles = async (list: FileList | File[] | null | undefined) => {
    if (!list) return
    const add: HarnessFile[] = [], rej: HarnessState['rejected'] = []
    for (const f of Array.from(list)) {
      if (state.files.length + add.length >= HS_MAX_FILES) { rej.push({ name: f.name, reason: 'too-many' }); continue }
      // Metadata first: nothing is read from a file that is too large or declared binary.
      const r = await readHarnessFile(f)
      if (r.reason || r.text === undefined) rej.push({ name: r.name, reason: r.reason ?? 'read' })
      else add.push({ name: r.name, text: r.text, kind: r.kind })
    }
    merge(add, rej)
    if (fileRef.current) fileRef.current.value = ''
  }

  const addPaste = () => {
    const name = pasteName.trim().slice(0, 260) || 'pasted.txt'
    if (!pasteBody.trim()) { toast(s.pasteEmpty, 'error'); return }
    if (byteLength(pasteBody) > HS_MAX_BYTES) { merge([], [{ name, reason: 'size' }]); return }
    merge([{ name, text: pasteBody, kind: detectKind(name, pasteBody) }], []); setPasteBody('')
  }
  const loadSamples = () => { setState({ files: HARNESS_SAMPLES.map(f => ({ ...f, kind: detectKind(f.name, f.text) })), rejected: [] }); setSev('all'); toast(s.samplesToast(HARNESS_SAMPLES.length)) }
  const clear = () => { setState({ files: [], rejected: [] }); setSev('all'); setPasteBody('') }
  const exp = (kind: 'sarif' | 'md') => {
    if (!res) return
    const g = kind === 'sarif' ? exportHarnessSarif(res, lang) : exportHarnessMarkdown(res, lang)
    if (!g.ok) { toast(s.blocked, 'error'); return }
    const name = kind === 'sarif' ? 'mcp-shield-harness.sarif' : 'mcp-shield-harness.md'
    download(name, g.text, kind === 'sarif' ? 'application/sarif+json' : 'text/markdown'); toast(t.toastDownloaded(name))
  }
  const inputCls = 'focus-ring w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[0.8125rem] text-white placeholder:text-slate-400'

  return (
    <div className="space-y-5" data-testid="harness">
      <header>
        <p className="kicker">{s.kicker}</p>
        <h1 className="display mt-1.5 text-white">{s.title}</h1>
        <p className="mt-1.5 max-w-3xl text-[0.875rem] leading-relaxed text-slate-300">{s.sub}</p>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-400"><Lock size={13} className="mt-[3px] shrink-0 text-emerald-400" aria-hidden />{s.privacy}</p>
      </header>

      <div data-testid="hs-actions" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button onClick={() => fileRef.current?.click()} className="btn-primary focus-ring w-full justify-start text-[0.8125rem] sm:w-auto"><Upload size={14} strokeWidth={1.8} aria-hidden />{s.open}</button>
        <input ref={fileRef} data-testid="hs-input" type="file" multiple accept={ACCEPT} className="hidden" aria-hidden tabIndex={-1} onChange={e => void addFiles(e.target.files)} />
        <button data-testid="hs-samples" onClick={loadSamples} className="btn-secondary focus-ring w-full justify-start text-[0.8125rem] sm:w-auto"><FlaskConical size={14} strokeWidth={1.8} aria-hidden />{s.samples}</button>
        <button data-testid="hs-clear" onClick={clear} disabled={!state.files.length && !state.rejected.length} className="btn-ghost focus-ring w-full justify-start text-[0.8125rem] disabled:opacity-50 sm:w-auto"><Trash2 size={14} strokeWidth={1.8} aria-hidden />{s.clear}</button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <section data-testid="hs-drop" aria-label={s.drop} data-drag={drag || undefined}
            onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files) }}
            className={`card flex flex-col items-center gap-2 px-4 py-6 text-center transition-colors duration-200 ${drag ? 'border-accent/60 bg-accent/[0.06]' : ''}`}>
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200"><Upload size={18} strokeWidth={1.8} aria-hidden /></span>
            <p className="text-[0.9375rem] font-medium text-white">{drag ? s.dropActive : s.drop}</p>
            <p className="max-w-md text-[0.75rem] text-slate-400">{s.dropHint}</p>
            <details className="group mt-1 w-full max-w-xl text-left">
              <summary className="focus-ring mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 text-[0.8125rem] text-slate-300 hover:text-white"><ClipboardPaste size={14} aria-hidden />{s.paste}<ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180" aria-hidden /></summary>
              <div className="mt-2 space-y-2">
                <label className="block text-[0.75rem] text-slate-400">{s.pasteName}<input data-testid="hs-paste-name" value={pasteName} onChange={e => setPasteName(e.target.value)} className={inputCls} autoComplete="off" spellCheck={false} /></label>
                <label className="block text-[0.75rem] text-slate-400">{s.pasteBody}<textarea data-testid="hs-paste" value={pasteBody} onChange={e => setPasteBody(e.target.value)} rows={6} spellCheck={false} className={`${inputCls} font-mono text-[0.75rem]`} /></label>
                <button data-testid="hs-add" onClick={addPaste} className="btn-ghost focus-ring text-[0.8125rem]"><Plus size={14} aria-hidden />{s.add}</button>
              </div>
            </details>
          </section>

          {state.rejected.length > 0 && <div role="alert" data-testid="hs-rejected" className="rounded-xl border border-amber-300/30 bg-amber-300/[0.07] px-3 py-2.5 text-[0.8125rem] text-amber-100">
            <p className="flex items-center gap-1.5 font-medium"><TriangleAlert size={14} aria-hidden />{s.rejectedTitle}</p>
            <ul className="mt-1 space-y-0.5 pl-5">{state.rejected.map((r, i) => <li key={i}><code className="break-all">{safeText(r.name)}</code>: {s.reject[r.reason]}</li>)}</ul>
          </div>}

          {!res ? <div className="card px-5 py-8 text-center">
            <FlaskConical size={22} className="mx-auto mb-2 text-slate-400" aria-hidden />
            <h2 className="text-[0.9375rem] font-semibold text-white">{s.emptyTitle}</h2>
            <p className="mx-auto mt-1 max-w-lg text-[0.8125rem] text-slate-400">{s.emptyBody}</p>
          </div> : <section aria-labelledby="hs-f" className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="hs-f" className="text-[0.9375rem] font-semibold text-white">{s.findings} <span className="font-normal text-slate-400">· {res.findings.length}</span></h2>
              <div role="group" aria-label={s.findings} className="ml-auto flex flex-wrap gap-1.5">
                {(['all', ...SEVS] as const).map(x => <button key={x} aria-pressed={sev === x} onClick={() => setSev(x)} className={`btn-chip focus-ring ${sev === x ? 'bg-white/[0.09] text-white' : ''}`}>{x === 'all' ? s.all : t.sevNames[x]}<span className="font-mono tabular-nums text-slate-400">{x === 'all' ? res.findings.length : res.counts[x]}</span></button>)}
              </div>
            </div>
            {truncated > 0 && <p className="mt-2 flex items-start gap-1.5 text-[0.75rem] text-amber-100"><Info size={13} className="mt-[0.2rem] shrink-0" aria-hidden />{s.truncated(truncated)}</p>}
            {res.findings.length === 0 ? <p className="mt-3 flex items-center gap-2 text-[0.8125rem] text-emerald-200"><ShieldCheck size={15} aria-hidden />{s.none}</p>
              : <div data-testid="hs-findings" className="mt-3 space-y-2">{shown.map(f => <HarnessFindingCard key={f.id} f={f} lang={lang} />)}</div>}
          </section>}
        </div>

        <aside className="min-w-0 space-y-4">
          {res && <section aria-label={s.risk} className="card p-4">
            <RiskMeter score={res.riskScore} grade={res.grade} label={t.score(res.riskScore, res.grade)} gradeWord={t.grade} riskWord={t.riskWord} />
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">{SEVS.map(x => <div key={x} className={`sev-${x} rounded-lg px-1 py-1.5`}><div className="font-mono text-[1rem] font-semibold tabular-nums">{res.counts[x]}</div><div className="text-[0.6875rem]">{t.sevNames[x]}</div></div>)}</div>
            <p className="mt-3 text-[0.75rem] text-slate-400">{s.staticNote}</p>
          </section>}

          {state.files.length > 0 && <section aria-labelledby="hs-files" className="card p-4">
            <h2 id="hs-files" className="text-[0.875rem] font-semibold text-white">{s.files} <span className="font-normal text-slate-400">· {state.files.length}</span></h2>
            <ul data-testid="hs-files" className="mt-2 space-y-1.5">{state.files.map(f => {
              const info = res?.files.find(x => x.name === f.name), k = info?.kind ?? f.kind ?? 'text', Icon = KIND_ICON(k)
              return <li key={f.name} className="flex items-center gap-2 text-[0.8125rem]">
                <Icon size={14} className="shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1"><span className="block truncate font-mono text-[0.75rem] text-slate-200" title={safeText(f.name)}>{safeText(f.name)}</span>
                  <span className="text-[0.6875rem] text-slate-400">{s.kinds[k]}{info ? ` · ${s.lines(info.lines)}` : ''}</span></span>
                {info && <Badge tone={info.findings ? 'danger' : 'success'}>{info.findings}</Badge>}
                <button onClick={() => setState(p => ({ ...p, files: p.files.filter(x => x.name !== f.name) }))} aria-label={s.remove(safeText(f.name))} className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"><X size={14} aria-hidden /></button>
              </li>
            })}</ul>
          </section>}

          {res && <section aria-labelledby="hs-exp" className="card p-4">
            <h2 id="hs-exp" className="text-[0.875rem] font-semibold text-white">{s.exports}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <button data-testid="hs-export-sarif" onClick={() => exp('sarif')} className="btn-chip focus-ring"><Download size={13} aria-hidden />SARIF</button>
              <button data-testid="hs-export-md" onClick={() => exp('md')} className="btn-chip focus-ring"><Download size={13} aria-hidden />Markdown</button>
            </div>
          </section>}

          <section aria-labelledby="hs-rules" className="card p-4">
            <h2 id="hs-rules" className="text-[0.875rem] font-semibold text-white">{s.rulesTitle}</h2>
            <ul className="mt-2 space-y-2">{HS_RULES.map(r => <li key={r.id} className="text-[0.75rem]">
              <div className="flex gap-2"><code className="shrink-0 text-slate-400">{r.id}</code><span className="text-slate-200">{r.name[lang]}</span></div>
              <div className="pl-[3.6rem] text-[0.6875rem] text-slate-400">{r.owasp} · {r.iso.map(i => isoLabel(i, lang)).join('; ')}</div>
            </li>)}</ul>
            <p data-testid="hs-mapping-note" className="mt-3 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-slate-400"><Info size={12} className="mt-[0.15rem] shrink-0" aria-hidden />{s.mappingNote}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
