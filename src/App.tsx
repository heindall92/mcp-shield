import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Shield, Swords, ScanSearch, Landmark, Sun, Moon, Languages, Search, CircleHelp, Upload, Printer, RotateCcw, Keyboard, ShieldCheck, Info, FlaskConical, FolderGit2, Fingerprint } from 'lucide-react'
import { Simulator } from './components/simulator/Simulator'
import { Auditor } from './components/auditor/Auditor'
import { Governance } from './components/governance/Governance'
import { Help } from './components/help/Help'
const IntegrityView = lazy(() => import('./components/integrity/IntegrityView').then(m => ({ default: m.IntegrityView })))
import { ZeroTelemetryModal } from './components/ui/ZeroTelemetry'
import { Segmented } from './components/ui/Segmented'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { CommandPalette, type Command } from './components/ui/CommandPalette'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { useToast } from './components/ui/toast'
import { clearAppStorage } from './i18n/storage'
import { usePrefs } from './i18n/prefs'
import { sampleConfigs } from './data/sampleConfigs'
import { REPO, VERSION, modKey, OPEN_FILE_EVENT } from './meta'

type Tab = 'auditor' | 'integridad' | 'simulador' | 'gobernanza' | 'ayuda'
const IDS: Tab[] = ['auditor', 'integridad', 'simulador', 'gobernanza', 'ayuda']
const parseHash = (): { tab: Tab; section?: string } => {
  const [h, section] = location.hash.slice(1).split('/')
  return { tab: IDS.find(t => t === h) ?? 'auditor', section }
}
const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export default function App() {
  const { t, lang, setLang, theme, setTheme } = usePrefs()
  const toast = useToast()
  const [route, setRoute] = useState(parseHash)
  const tab = route.tab
  const [modal, setModal] = useState(false)
  const [palette, setPalette] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  // User input lives only in memory: never persisted to storage, never logged.
  const [text, setText] = useState('')
  const [epoch, setEpoch] = useState(0)
  const resetAll = useCallback(() => { setText(''); clearAppStorage(); setEpoch(e => e + 1); toast(t.toastReset) }, [toast, t])

  useEffect(() => { const h = () => setRoute(parseHash()); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h) }, [])
  const go = useCallback((x: Tab, section?: string) => {
    history.replaceState(null, '', `#${x}${section ? '/' + section : ''}`); setRoute({ tab: x, section })
    if (section) requestAnimationFrame(() => document.getElementById(`h-${section}`)?.scrollIntoView({ block: 'start' })); else scrollTo({ top: 0 })
  }, [])
  useEffect(() => { if (route.section) requestAnimationFrame(() => document.getElementById(`h-${route.section}`)?.scrollIntoView({ block: 'start' })) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDemo = useCallback((id: string) => {
    const s = sampleConfigs.find(x => x.id === id); if (!s) return
    setText(JSON.stringify(s.config, null, 2)); go('auditor'); toast(t.toastDemo(lang === 'en' ? s.labelEn : s.label))
  }, [go, toast, t, lang])
  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])
  const toggleLang = useCallback(() => setLang(lang === 'es' ? 'en' : 'es'), [lang, setLang])

  const tabs = [
    { value: 'auditor' as const, label: t.tabAudit, Icon: ScanSearch },
    { value: 'integridad' as const, label: t.tabInt, Icon: Fingerprint },
    { value: 'simulador' as const, label: t.tabSim, Icon: Swords },
    { value: 'gobernanza' as const, label: t.tabGov, Icon: Landmark },
  ]
  const commands: Command[] = useMemo(() => [
    ...tabs.map((x, i) => ({ id: `go-${x.value}`, group: t.grpGo, label: x.label, Icon: x.Icon, run: () => go(x.value), hint: String(i + 1) })),
    { id: 'go-ayuda', group: t.grpGo, label: t.tabHelp, Icon: CircleHelp, run: () => go('ayuda'), hint: '5' },
    { id: 'open', group: t.grpAct, label: t.cmdOpen, Icon: Upload, run: () => { go('auditor'); requestAnimationFrame(() => dispatchEvent(new Event(OPEN_FILE_EVENT))) }, keywords: 'json file archivo import' },
    { id: 'print', group: t.grpAct, label: t.cmdPrint, Icon: Printer, run: () => { go('auditor'); setTimeout(() => print(), 50) }, keywords: 'pdf report informe' },
    { id: 'reset', group: t.grpAct, label: t.resetBtn, Icon: RotateCcw, run: () => setConfirmReset(true), keywords: 'clear limpiar borrar' },
    ...sampleConfigs.map(s => ({ id: `demo-${s.id}`, group: t.grpDemo, label: lang === 'en' ? s.labelEn : s.label, Icon: FlaskConical, run: () => loadDemo(s.id), keywords: 'demo ejemplo example sample' })),
    { id: 'theme', group: t.grpPrefs, label: t.cmdTheme(theme === 'dark'), Icon: theme === 'dark' ? Sun : Moon, run: toggleTheme, hint: 'T', keywords: 'theme tema dark light' },
    { id: 'lang', group: t.grpPrefs, label: t.cmdLang, Icon: Languages, run: toggleLang, hint: 'L', keywords: 'language idioma' },
    { id: 'keys', group: t.grpHelp, label: t.cmdShortcuts, Icon: Keyboard, run: () => go('ayuda', 'atajos'), hint: '?' },
    { id: 'privacy', group: t.grpHelp, label: t.cmdPrivacy, Icon: ShieldCheck, run: () => go('ayuda', 'privacidad') },
    { id: 'zero', group: t.grpHelp, label: t.cmdZero, Icon: ShieldCheck, run: () => setModal(true) },
    { id: 'legal', group: t.grpHelp, label: t.hLegal, Icon: ShieldCheck, run: () => go('ayuda', 'legal'), keywords: 'legal privacy privacidad licencia license warranty garantía' },
    { id: 'credits', group: t.grpHelp, label: t.hCredits, Icon: Info, run: () => go('ayuda', 'creditos'), keywords: 'credits créditos lucide license' },
    { id: 'about', group: t.grpHelp, label: t.cmdAbout, Icon: Info, run: () => go('ayuda', 'acerca') },
  ], [t, lang, theme, go, loadDemo, toggleTheme, toggleLang]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); return }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return
      if (e.key === '/') { e.preventDefault(); const q = document.getElementById('help-q'); if (q && tab === 'ayuda') q.focus(); else setPalette(true) }
      else if (e.key === '?') { e.preventDefault(); go('ayuda', 'atajos') }
      else if (/^[1-5]$/.test(e.key)) go(IDS[Number(e.key) - 1])
      else if (e.key === 't' || e.key === 'T') toggleTheme()
      else if (e.key === 'l' || e.key === 'L') toggleLang()
    }
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey)
  }, [tab, go, toggleTheme, toggleLang])

  return (
    <div className="min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-elevated focus:px-3 focus:py-2 focus:text-white">{lang === 'es' ? 'Saltar al contenido' : 'Skip to content'}</a>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[26rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--slate-400)/0.07),transparent)] print:hidden" />
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[87.5rem] items-center gap-3 px-4 py-2.5 sm:px-6">
          <a href="#auditor" onClick={e => { e.preventDefault(); go('auditor') }} className="focus-ring flex items-center gap-2.5 rounded-lg">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/[0.1] bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgb(var(--white)/0.08)]"><Shield size={16} strokeWidth={2} aria-hidden /></div>
            <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-white">MCP-Shield</span>
          </a>
          <nav aria-label={t.navLabel} className="ml-3 hidden md:block"><Segmented label={t.navLabel} options={tabs} value={tab === 'ayuda' ? null : tab} onChange={x => go(x)} /></nav>
          <div className="ml-auto flex items-center gap-2">
            <button data-testid="search-pill" onClick={() => setPalette(true)} aria-label={t.search} aria-keyshortcuts="Control+K Meta+K"
              className="press focus-ring inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 text-[0.75rem] text-slate-400 hover:bg-white/[0.06] hover:text-white">
              <Search size={14} aria-hidden /><span className="hidden xl:inline">{t.searchShort}</span><kbd className="kbd hidden sm:inline-flex">{modKey()} K</kbd>
            </button>
            <button onClick={() => setModal(true)} className="press focus-ring hidden h-8 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-[0.75rem] font-medium text-slate-300 hover:bg-white/[0.06] sm:inline-flex">
              <span aria-hidden className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 rounded-full bg-emerald-400" /></span>
              <span className="hidden lg:inline">{t.badgeLong}</span><span className="lg:hidden">{t.badgeShort}</span>
            </button>
            <div className="flex items-center gap-1.5"><Languages size={15} strokeWidth={1.8} className="hidden text-slate-400 sm:block" aria-hidden />
              <Segmented size="sm" label={t.langLabel} value={lang} onChange={setLang} options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]} /></div>
            <Segmented size="sm" iconOnly label={t.themeLabel} value={theme} onChange={setTheme}
              options={[{ value: 'light', label: t.themeLight, Icon: Sun }, { value: 'dark', label: t.themeDark, Icon: Moon }]} />
            <button data-testid="help-btn" onClick={() => go('ayuda')} aria-label={t.tabHelp} aria-current={tab === 'ayuda' ? 'page' : undefined} title={`${t.tabHelp} (?)`}
              className={`press focus-ring grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] hover:bg-white/[0.06] hover:text-white ${tab === 'ayuda' ? 'bg-white/[0.08] text-white' : 'bg-white/[0.03] text-slate-400'}`}><CircleHelp size={16} aria-hidden /></button>
          </div>
        </div>
        <nav aria-label={t.navLabel} className="border-t border-white/[0.05] px-3 py-2 md:hidden"><Segmented full label={t.navLabel} options={tabs} value={tab === 'ayuda' ? null : tab} onChange={x => go(x)} /></nav>
      </header>
      <main id="main" tabIndex={-1} className="relative mx-auto max-w-[87.5rem] px-4 py-5 outline-none sm:px-6 sm:py-7">
        <ErrorBoundary lang={lang} resetKey={`${tab}-${epoch}`} onReset={resetAll}>
          {tab === 'auditor' && <Auditor key={epoch} text={text} setText={setText} onReset={resetAll} onLoadDemo={loadDemo} />}
          {tab === 'integridad' && <Suspense fallback={<p role="status" className="text-[0.8125rem] text-slate-400">…</p>}><IntegrityView key={epoch} /></Suspense>}
          {tab === 'simulador' && <Simulator onAudit={j => { setText(j); go('auditor') }} />}
          {tab === 'gobernanza' && <Governance />}
          {tab === 'ayuda' && <Help initial={route.section} />}
        </ErrorBoundary>
      </main>
      <footer className="mx-auto flex max-w-[87.5rem] flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-8 text-[0.75rem] text-slate-400">
        <span className="min-w-0 flex-1">{t.footer}</span>
        <span>v{VERSION}</span>
        <a href={REPO} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 rounded hover:text-white"><FolderGit2 size={13} aria-hidden />GitHub</a>
        <a href="#ayuda/legal" onClick={e => { e.preventDefault(); go('ayuda', 'legal') }} className="focus-ring rounded hover:text-white">{t.hLegal}</a>
        <a href="#ayuda/creditos" onClick={e => { e.preventDefault(); go('ayuda', 'creditos') }} className="focus-ring rounded hover:text-white">{t.hCredits}</a>
        <a href="#ayuda/atajos" onClick={e => { e.preventDefault(); go('ayuda', 'atajos') }} className="focus-ring rounded hover:text-white">{t.hKeys}</a>
      </footer>
      <ZeroTelemetryModal open={modal} onClose={() => setModal(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} title={t.palTitle} placeholder={t.search} empty={t.palEmpty} hint={t.palHint} />
      <ConfirmDialog open={confirmReset} title={t.resetTitle} body={t.resetBody} confirm={t.resetConfirm} cancel={t.cancel} onConfirm={() => { resetAll(); go('auditor') }} onClose={() => setConfirmReset(false)} />
    </div>
  )
}
