import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Fingerprint, FlaskConical, Upload, FileJson, ShieldAlert, ShieldCheck, Check, X, Clock, RefreshCcw, Lock, Unlock, Download, AlertTriangle, Info, Trash2, KeyRound, CircleDashed, CheckCircle2, XCircle } from 'lucide-react'
import type { MCPShieldSnapshot, DecisionRecord, IntegrityEvent, IntegrityEventType } from '../../integrity/domain/types'
import type { Severity } from '../../types/mcp.types'
import { usePrefs } from '../../i18n/prefs'
import { intStrings } from '../../i18n/integrity'
import { useToast } from '../ui/toast'
import { Badge } from '../ui/Badge'
import { analyze, type Analysis } from '../../integrity/analysis'
import { generateHmacKey, importHmacKey, type HmacKey } from '../../integrity/crypto/hashes'
import { sealBaseline, openBaseline, keyToB64, keyFromB64, PackageError, MIN_PASSWORD } from '../../integrity/crypto/encryptedBaseline'
import { decide, stateOf, TOFU_CHECKLIST, DecisionError } from '../../integrity/domain/decisions'
import { exportJson, exportSarif, exportMarkdown, type Gated } from '../../integrity/evidence/integrityExporter'
import { parseCapture } from '../../integrity/workers/parse'
import { demoBaseline, demoCandidate, demoOtherContext } from '../../integrity/demo/demoSnapshots'
import type { Issue } from '../../integrity/capture/limits'
import { download } from '../../engine/sarifExporter'
import { safeText } from '../../engine/redact'

/**
 * Integrity view (RFC-001 §12). Server-provided strings are rendered only as React text nodes
 * (never HTML), passed through safeText, and clipped. No storage: state lives in this component.
 */
const SEV: Record<Severity, 'danger' | 'warning' | 'neutral'> = { critical: 'danger', high: 'danger', medium: 'warning', low: 'neutral' }
const EV_TONE: Record<IntegrityEventType, 'danger' | 'warning' | 'info' | 'neutral'> = { INVISIBLE_PAYLOAD: 'danger', INPUT_EXPANDED: 'danger', DESCRIPTION_CHANGED: 'warning', TOOL_ADDED: 'warning', ANNOTATION_CHANGED: 'warning', SCHEMA_CHANGED: 'info', TOOL_REMOVED: 'neutral', INTEGRITY_MISMATCH: 'warning', CONTEXT_MISMATCH: 'danger' }
const PRIO: IntegrityEventType[] = ['CONTEXT_MISMATCH', 'INVISIBLE_PAYLOAD', 'INPUT_EXPANDED', 'DESCRIPTION_CHANGED', 'SCHEMA_CHANGED', 'ANNOTATION_CHANGED', 'TOOL_ADDED', 'TOOL_REMOVED', 'INTEGRITY_MISMATCH']
const short = (h?: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : '—')
const txt = (s: string, n = 600) => safeText(s).slice(0, n)

function HashChip({ label, value }: { label: string; value?: string }) {
  return <span title={value} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[0.6875rem] text-slate-300"><Fingerprint size={12} aria-hidden /><span className="font-sans text-slate-400">{label}</span>{short(value)}</span>
}

function Metric({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return <div className="card px-4 py-3"><div className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</div><div className={`mt-1 text-[1.5rem] font-semibold tabular-nums tracking-[-0.02em] ${tone}`}>{value}</div></div>
}

export function IntegrityView() {
  const { lang, t } = usePrefs()
  const s = intStrings(lang)
  const toast = useToast()
  const [key, setKey] = useState<HmacKey>()
  const [baseline, setBaseline] = useState<{ snap: MCPShieldSnapshot; approved: boolean }>()
  const [candidate, setCandidate] = useState<MCPShieldSnapshot>()
  const [log, setLog] = useState<DecisionRecord[]>([])
  const [raw, setRes] = useState<Analysis>()
  const [issues, setIssues] = useState<Issue[]>([])
  const [text, setText] = useState('')
  const [as, setAs] = useState<'baseline' | 'candidate'>('baseline')
  const [ctx, setCtx] = useState({ profileId: '', authContextId: '', serverLabel: '', protocolVersion: '2026-07-28', transport: 'stdio' })
  const [busy, setBusy] = useState(false)
  const [tofu, setTofu] = useState<string[]>([])
  const [reviewBy, setReviewBy] = useState('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<IntegrityEventType | 'all'>('all')
  const [pw, setPw] = useState('')
  const [pkgBusy, setPkgBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null), pkgRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void generateHmacKey().then(setKey) }, [])
  // TOFU mode analyses the unapproved baseline alone; once approved, the candidate is diffed against it.
  const subject = baseline && !baseline.approved ? baseline.snap : candidate
  const reference = baseline?.approved ? baseline.snap : undefined
  useEffect(() => {
    let live = true
    if (!key || !subject) return
    void analyze(subject, reference, key, lang).then(r => { if (live) setRes(r) })
    return () => { live = false }
  }, [key, subject, reference, lang])
  const res = raw && subject && raw.candidate === subject && raw.baseline === reference ? raw : undefined

  const reset = () => { setBaseline(undefined); setCandidate(undefined); setLog([]); setIssues([]); setTofu([]); setFilter('all') }
  const loadDemo = (other = false) => { reset(); setBaseline({ snap: demoBaseline(), approved: false }); setCandidate(other ? demoOtherContext() : demoCandidate()); toast(s.demo) }

  const doImport = async (raw: string) => {
    setBusy(true)
    try {
      const r = await parseCapture(raw, { ...ctx, transport: ctx.transport as 'stdio' | 'streamable-http' })
      setIssues(r.issues)
      if (r.snapshot) {
        if (as === 'baseline') { setBaseline({ snap: r.snapshot, approved: false }); setTofu([]) } else setCandidate(r.snapshot)
        setText(''); toast(s.imported(r.snapshot.tools.length))
      }
    } finally { setBusy(false) }
  }
  const onFile = async (f?: File) => { if (f) await doImport(await f.text()) }

  const state = stateOf(log, res?.cand.root)
  const record = (decision: DecisionRecord['decision']) => {
    if (!res) return
    try {
      const next = decide(log, { decision, candidateRoot: res.cand.root, baselineRoot: res.base?.root, candidateSnapshotId: res.candidate.snapshotId, tofu, reviewBy: reviewBy || undefined, note: note || undefined, comparable: res.comparability.comparable })
      setLog(next); setNote('')
      if (decision === 'approved') {
        setBaseline({ snap: res.candidate, approved: true }); if (!res.firstBaseline) setCandidate(undefined); else setTofu([])
        toast(s.approvedToast)
      } else toast(decision === 'rejected' ? s.rejectedToast : s.recordedToast)
    } catch (e) { toast(e instanceof DecisionError ? s.decErr[e.message] ?? e.message : 'Error', 'error') }
  }

  const exp = (g: Gated, name: string, mime: string) => { if (!g.ok) { toast(s.blocked, 'error'); return } download(name, g.text, mime); toast(name) }

  const seal = async () => {
    if (!baseline?.approved || !key) return
    setPkgBusy(true)
    try { const p = await sealBaseline({ snapshot: baseline.snap, hmacKey: keyToB64(key.raw), decisions: log }, pw); download('mcp-shield-baseline.json', JSON.stringify(p, null, 2), 'application/json'); setPw('') }
    catch (e) { toast(e instanceof PackageError ? s.pkgErr[e.code] : 'Error', 'error') } finally { setPkgBusy(false) }
  }
  const unseal = async (f?: File) => {
    if (!f) return
    setPkgBusy(true)
    try {
      const p = await openBaseline(await f.text(), pw)
      setKey(await importHmacKey(keyFromB64(p.hmacKey))); setBaseline({ snap: p.snapshot, approved: true }); setLog(p.decisions); setCandidate(undefined); setPw(''); toast(s.pkgOk)
    } catch (e) { toast(e instanceof PackageError ? s.pkgErr[e.code] : s.pkgErr.format, 'error') } finally { setPkgBusy(false); if (pkgRef.current) pkgRef.current.value = '' }
  }

  const events = useMemo(() => (res?.events ?? []).filter(e => filter === 'all' || e.type === filter).sort((a, b) => PRIO.indexOf(a.type) - PRIO.indexOf(b.type)), [res, filter])
  const types = useMemo(() => [...new Set((res?.events ?? []).map(e => e.type))], [res])
  const blocked = res && !res.comparability.comparable
  const tofuMode = res?.firstBaseline
  const inputCls = 'focus-ring w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[0.8125rem] text-white placeholder:text-slate-400'

  return (
    <div className="space-y-5" data-testid="integrity">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-slate-400">{s.kicker}</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.025em] text-white">{s.title}</h1>
          <p className="mt-1.5 max-w-3xl text-[0.875rem] leading-relaxed text-slate-300">{s.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button data-testid="int-demo" onClick={() => loadDemo()} className="btn-primary focus-ring text-[0.8125rem]"><FlaskConical size={14} aria-hidden />{s.demo}</button>
          <button data-testid="int-demo-ctx" onClick={() => loadDemo(true)} className="btn-ghost focus-ring text-[0.8125rem]"><FlaskConical size={14} aria-hidden />{s.demoCtx}</button>
          <button onClick={reset} className="btn-ghost focus-ring text-[0.8125rem]"><Trash2 size={14} aria-hidden />{s.clear}</button>
        </div>
      </header>
      <p className="flex items-start gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-[0.8125rem] text-cyan-100"><Info size={15} className="mt-0.5 shrink-0" aria-hidden />{s.untrusted}</p>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {/* Approved vs candidate */}
          <section aria-labelledby="int-pair" className="card p-4">
            <h2 id="int-pair" className="sr-only">{s.baselineCol} / {s.candidateCol}</h2>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
              {([['baseline', baseline?.snap, res?.firstBaseline ? res.cand : res?.base] as const, ['candidate', baseline?.approved ? candidate : undefined, res?.firstBaseline ? undefined : res?.cand] as const]).map(([k, snap, fp]) => (
                <div key={k} data-testid={`int-${k}`} className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[0.875rem] font-semibold text-white">{k === 'baseline' ? s.baselineCol : s.candidateCol}</h3>
                    {snap ? <>
                      {k === 'baseline' ? <Badge tone={baseline?.approved ? 'success' : 'warning'}>{baseline?.approved ? s.approved : s.pending}</Badge> : <Badge tone="info">{s.importedState}</Badge>}
                      <Badge>{snap.capture.completeness}</Badge>
                      {!snap.provenance.verifiedCollector && <Badge>{s.unverified}</Badge>}
                    </> : <Badge>{k === 'baseline' ? s.noBaseline : s.noCandidate}</Badge>}
                  </div>
                  {snap && <>
                    <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[0.75rem]">
                      {(['serverLabel', 'profileId', 'authContextId', 'transport', 'protocolVersion'] as const).map(f => <Fragment key={f}><dt className="text-slate-400">{s.ctx[f]}</dt><dd className="truncate font-mono text-slate-200">{txt(snap.target[f], 80)}</dd></Fragment>)}
                      <dt className="text-slate-400">{s.tools}</dt><dd className="font-mono text-slate-200">{snap.tools.length}</dd>
                    </dl>
                    {fp && <div className="mt-2.5 flex flex-wrap gap-1.5"><HashChip label={s.publicHash} value={fp.publicRoot} /><HashChip label={s.rootHmac} value={fp.root} /></div>}
                  </>}
                </div>
              ))}
            </div>
          </section>

          {res && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={s.intRisk} value={blocked || tofuMode ? '—' : String(res.integrityRisk)} tone={res.integrityRisk >= 60 ? 'text-red-300' : res.integrityRisk >= 20 ? 'text-amber-200' : 'text-white'} />
            <Metric label={s.cfgRisk} value={String(res.configRisk.riskScore)} tone={res.configRisk.riskScore >= 60 ? 'text-red-300' : res.configRisk.riskScore >= 20 ? 'text-amber-200' : 'text-white'} />
            <Metric label={s.events} value={String(res.events.length)} />
            <Metric label={s.review} value={s.state[state]} tone="text-white text-[1rem]" />
          </div>}

          {blocked && <div role="alert" data-testid="int-mismatch" className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/[0.07] px-3 py-2.5 text-[0.8125rem] text-red-100"><ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden /><div><strong className="font-semibold">{s.mismatch}</strong> {s.mismatchBody(res.comparability.blockers.join(', '))}</div></div>}
          {res && res.comparability.warnings.length > 0 && <ul className="space-y-1">{res.comparability.warnings.map(w => <li key={w} className="flex items-center gap-2 text-[0.8125rem] text-amber-100"><AlertTriangle size={14} aria-hidden />{s.warn[w] ?? w}</li>)}</ul>}
          {res && res.unconfirmedMissing.length > 0 && <p className="text-[0.8125rem] text-slate-300">{s.missing(res.unconfirmedMissing.map(n => txt(n, 60)).join(', '))}</p>}

          {/* Events */}
          {res && !tofuMode && <section aria-labelledby="int-ev" className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="int-ev" className="text-[0.9375rem] font-semibold text-white">{s.events}</h2>
              <div role="group" aria-label={s.events} className="ml-auto flex flex-wrap gap-1.5">
                {(['all', ...types] as const).map(x => <button key={x} aria-pressed={filter === x} onClick={() => setFilter(x)} className={`btn-chip focus-ring ${filter === x ? 'bg-white/[0.09] text-white' : ''}`}>{x === 'all' ? s.filterAll : s.ev[x]}</button>)}
              </div>
            </div>
            {events.length === 0 ? <p className="mt-3 flex items-center gap-2 text-[0.8125rem] text-emerald-200"><ShieldCheck size={15} aria-hidden />{s.noEvents}</p>
              : <ol className="mt-3 space-y-2.5" data-testid="int-events">{events.map((e, i) => <EventCard key={i} e={e} />)}</ol>}
          </section>}

          {res && <section aria-labelledby="int-f" className="card p-4">
            <h2 id="int-f" className="text-[0.9375rem] font-semibold text-white">{s.intFindings}</h2>
            {tofuMode || blocked ? <p className="mt-2 text-[0.8125rem] text-slate-400">{s.state.unreviewed}: {tofuMode ? s.noBaseline : s.mismatch}</p> :
              res.findings.length === 0 ? <p className="mt-2 text-[0.8125rem] text-slate-400">{s.none}</p> :
              <ul className="mt-2 space-y-1.5" data-testid="int-findings">{res.findings.map((f, i) => <li key={i} className="flex flex-wrap items-center gap-2 text-[0.8125rem]"><Badge tone={SEV[f.severity]}>{f.severity}</Badge><code className="text-[0.6875rem] text-slate-400">{f.ruleId}</code><span className="min-w-0 break-words text-slate-200">{txt(f.title, 200)}</span></li>)}</ul>}
            <h3 className="mt-4 text-[0.8125rem] font-semibold text-white">{s.cfgFindings}</h3>
            {res.configRisk.findings.length === 0 ? <p className="mt-1 text-[0.8125rem] text-slate-400">{s.none}</p> :
              <ul className="mt-1.5 space-y-1.5">{res.configRisk.findings.map(f => <li key={f.id} className="flex flex-wrap items-center gap-2 text-[0.8125rem]"><Badge tone={SEV[f.severity]}>{f.severity}</Badge><code className="text-[0.6875rem] text-slate-400">{f.ruleId}</code><span className="min-w-0 break-words text-slate-200">{txt(f.title, 200)}</span></li>)}</ul>}
            <p className="mt-3 text-[0.75rem] text-slate-400">{s.declared}</p>
          </section>}

          {/* Import */}
          <section aria-labelledby="int-imp" className="card p-4">
            <h2 id="int-imp" className="text-[0.9375rem] font-semibold text-white">{s.importTitle}</h2>
            <fieldset className="mt-2 flex flex-wrap items-center gap-3 text-[0.8125rem] text-slate-300"><legend className="sr-only">{s.importAs}</legend><span>{s.importAs}</span>
              {(['baseline', 'candidate'] as const).map(x => <label key={x} className="inline-flex items-center gap-1.5"><input type="radio" name="int-as" checked={as === x} onChange={() => setAs(x)} className="accent-cyan-400" />{x === 'baseline' ? s.asBaseline : s.asCandidate}</label>)}
            </fieldset>
            <details className="mt-2"><summary className="focus-ring cursor-pointer rounded text-[0.8125rem] text-slate-300">{s.ctxTitle}</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">{(['profileId', 'authContextId', 'serverLabel', 'protocolVersion'] as const).map(f => <label key={f} className="text-[0.75rem] text-slate-400">{s.ctx[f]}<input value={ctx[f]} onChange={e => setCtx({ ...ctx, [f]: e.target.value })} className={inputCls} autoComplete="off" spellCheck={false} /></label>)}
                <label className="text-[0.75rem] text-slate-400">{s.ctx.transport}<select value={ctx.transport} onChange={e => setCtx({ ...ctx, transport: e.target.value })} className={inputCls}><option value="stdio">stdio</option><option value="streamable-http">streamable-http</option></select></label></div>
            </details>
            <label className="mt-2 block text-[0.75rem] text-slate-400">{s.paste}<textarea value={text} onChange={e => setText(e.target.value)} rows={4} spellCheck={false} autoComplete="off" className={`${inputCls} font-mono`} /></label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button disabled={busy || !text.trim()} onClick={() => void doImport(text)} className="btn-ghost focus-ring text-[0.8125rem]"><FileJson size={14} aria-hidden />{busy ? s.parsing : s.doImport}</button>
              <button onClick={() => fileRef.current?.click()} className="btn-ghost focus-ring text-[0.8125rem]"><Upload size={14} aria-hidden />{s.fromFile}</button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" aria-hidden tabIndex={-1} onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            </div>
            {issues.length > 0 && <ul aria-label={s.issues} className="mt-2 space-y-1 text-[0.8125rem]">{issues.slice(0, 12).map((x, i) => <li key={i} className={`flex items-center gap-1.5 ${x.level === 'error' ? 'text-red-200' : 'text-amber-100'}`}>{x.level === 'error' ? <XCircle size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}{s.issue[x.code] ?? x.code}{x.at ? <code className="text-[0.6875rem] text-slate-400">{txt(x.at, 60)}</code> : null}</li>)}</ul>}
            <p className="mt-3 text-[0.75rem] text-slate-400">{s.cli}</p>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section aria-labelledby="int-rev" className="card p-4" data-testid="int-review">
            <h2 id="int-rev" className="text-[0.9375rem] font-semibold text-white">{s.review}</h2>
            <p className="mt-1 text-[0.75rem] text-slate-400">{s.neverAuto}</p>
            {res && tofuMode && <fieldset className="mt-3"><legend className="text-[0.8125rem] font-medium text-amber-100">{s.tofuTitle}</legend>
              <ul className="mt-2 space-y-1.5">{TOFU_CHECKLIST.map(i => <li key={i}><label className="flex items-start gap-2 text-[0.8125rem] text-slate-200"><input type="checkbox" className="mt-0.5 accent-cyan-400" checked={tofu.includes(i)} onChange={e => setTofu(e.target.checked ? [...tofu, i] : tofu.filter(x => x !== i))} />{s.tofu[i]}</label></li>)}</ul></fieldset>}
            {res && <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button data-testid="int-approve" disabled={blocked || (tofuMode && tofu.length < TOFU_CHECKLIST.length)} onClick={() => record('approved')} className="btn-primary focus-ring justify-center text-[0.8125rem] disabled:opacity-40"><Check size={14} aria-hidden />{s.approve}</button>
                <button onClick={() => record('rejected')} className="btn-ghost focus-ring justify-center text-[0.8125rem]"><X size={14} aria-hidden />{s.reject}</button>
                {!tofuMode && <button disabled={blocked} onClick={() => record('accepted-risk')} className="btn-ghost focus-ring justify-center text-[0.8125rem]"><Clock size={14} aria-hidden />{s.accept}</button>}
                <button onClick={() => record('needs-revalidation')} className="btn-ghost focus-ring justify-center text-[0.8125rem]"><RefreshCcw size={14} aria-hidden />{s.reval}</button>
              </div>
              {!tofuMode && <label className="mt-2 block text-[0.75rem] text-slate-400">{s.reviewBy}<input type="date" value={reviewBy} onChange={e => setReviewBy(e.target.value)} className={inputCls} /></label>}
              <label className="mt-2 block text-[0.75rem] text-slate-400">{s.note}<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} className={inputCls} autoComplete="off" /></label>
            </>}
          </section>

          {res && <section aria-labelledby="int-cov" className="card p-4">
            <h2 id="int-cov" className="text-[0.9375rem] font-semibold text-white">{s.coverage}</h2>
            <ul className="mt-2 space-y-1">{res.coverage.map(c => <li key={c.ruleId} className="flex items-center gap-2 text-[0.75rem]" title={c.diagnostic}>
              {c.status === 'PASS' ? <CheckCircle2 size={13} className="text-emerald-400" aria-hidden /> : c.status === 'FAIL' ? <XCircle size={13} className="text-red-400" aria-hidden /> : <CircleDashed size={13} className="text-slate-400" aria-hidden />}
              <code className="shrink-0 whitespace-nowrap text-slate-400">{c.ruleId}</code><span className="min-w-0 truncate text-slate-300">{c.name[lang]}</span><span className="ml-auto shrink-0 text-slate-400">{t.covStatus[c.status]}</span></li>)}</ul>
          </section>}

          <section aria-labelledby="int-log" className="card p-4">
            <h2 id="int-log" className="text-[0.875rem] font-semibold text-white">{s.log}</h2>
            {log.length === 0 ? <p className="mt-1.5 text-[0.75rem] text-slate-400">{s.logEmpty}</p> :
              <ol className="mt-2 space-y-1.5" data-testid="int-log">{[...log].reverse().map((d, i) => <li key={i} className="text-[0.75rem] text-slate-300"><span className="font-medium text-white">{s.state[d.decision]}</span> · <span className="font-mono">{short(d.candidateRoot)}</span>{d.reviewBy ? ` · ${d.reviewBy}` : ''}<div className="text-slate-400">{d.at.replace('T', ' ').slice(0, 19)} UTC{d.note ? ` · ${txt(d.note, 120)}` : ''}</div></li>)}</ol>}
          </section>

          {res && <section aria-labelledby="int-exp" className="card p-4">
            <h2 id="int-exp" className="text-[0.875rem] font-semibold text-white">{s.exports}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => exp(exportSarif(res, lang), 'mcp-shield-integrity.sarif', 'application/sarif+json')} className="btn-chip focus-ring"><Download size={13} aria-hidden />SARIF</button>
              <button onClick={() => exp(exportMarkdown(res, lang, log), 'mcp-shield-integrity.md', 'text/markdown')} className="btn-chip focus-ring"><Download size={13} aria-hidden />Markdown</button>
              <button onClick={() => exp(exportJson(res, log), 'mcp-shield-integrity.json', 'application/json')} className="btn-chip focus-ring"><Download size={13} aria-hidden />JSON</button>
            </div>
          </section>}

          <section aria-labelledby="int-pkg" className="card p-4">
            <h2 id="int-pkg" className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-white"><KeyRound size={14} aria-hidden />{s.pkg}</h2>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-slate-400">{s.pkgBody}</p>
            <label className="mt-2 block text-[0.75rem] text-slate-400">{s.password}<input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" className={inputCls} /></label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button disabled={pkgBusy || !baseline?.approved || pw.length < MIN_PASSWORD} onClick={() => void seal()} className="btn-ghost focus-ring text-[0.8125rem]"><Lock size={14} aria-hidden />{pkgBusy ? s.working : s.seal}</button>
              <button disabled={pkgBusy || pw.length < MIN_PASSWORD} onClick={() => pkgRef.current?.click()} className="btn-ghost focus-ring text-[0.8125rem]"><Unlock size={14} aria-hidden />{s.open}</button>
              <input ref={pkgRef} type="file" accept=".json,application/json" className="hidden" aria-hidden tabIndex={-1} onChange={e => void unseal(e.target.files?.[0])} />
            </div>
            <p className="mt-2 text-[0.6875rem] text-slate-400">{s.key}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function EventCard({ e }: { e: IntegrityEvent }) {
  const { lang } = usePrefs()
  const s = intStrings(lang)
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={EV_TONE[e.type]}>{s.ev[e.type]}</Badge>
        {e.tool && <code className="break-all text-[0.8125rem] font-semibold text-white">{txt(e.tool, 120)}</code>}
        <span className="ml-auto text-[0.6875rem] text-slate-400">{s.confidence[e.confidence]}</span>
      </div>
      {e.notes.length > 0 && <p className="mt-1 text-[0.6875rem] text-slate-400">{e.notes.map(n => txt(n, 80)).join(' · ')}</p>}
      {e.changes.length > 0 && <div className="mt-2 space-y-2">{e.changes.slice(0, 12).map((c, i) => (
        <div key={i} className="min-w-0">
          <code className="break-all text-[0.6875rem] text-slate-400">{txt(c.path, 160)}</code>
          <div className="mt-1 grid gap-1.5 md:grid-cols-2">
            {c.before !== undefined && <pre aria-label={s.before} className="min-w-0 whitespace-pre-wrap break-all rounded-lg border border-red-400/15 bg-red-400/[0.05] px-2 py-1.5 font-mono text-[0.6875rem] leading-relaxed text-red-100"><span className="select-none text-red-300" aria-hidden>- </span>{txt(c.before)}</pre>}
            {c.after !== undefined && <pre aria-label={s.after} className={`min-w-0 whitespace-pre-wrap break-all rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1.5 font-mono text-[0.6875rem] leading-relaxed text-emerald-100 ${c.before === undefined ? 'md:col-span-2' : ''}`}><span className="select-none text-emerald-300" aria-hidden>+ </span>{txt(c.after)}</pre>}
          </div>
        </div>))}</div>}
    </li>
  )
}
