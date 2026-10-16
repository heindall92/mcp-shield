import { useEffect, useState } from 'react'
import { Shield, Swords, ScanSearch, Landmark, Sun, Moon, Languages } from 'lucide-react'
import { Simulator } from './components/simulator/Simulator'
import { Auditor } from './components/auditor/Auditor'
import { Governance } from './components/governance/Governance'
import { ZeroTelemetryModal } from './components/ui/ZeroTelemetry'
import { Segmented } from './components/ui/Segmented'
import { sampleConfigs } from './data/sampleConfigs'
import { usePrefs } from './i18n/prefs'

type Tab = 'simulador' | 'auditor' | 'gobernanza'
const IDS: Tab[] = ['simulador', 'auditor', 'gobernanza']
const fromHash = (): Tab => IDS.find(t => `#${t}` === location.hash) ?? 'simulador'

export default function App() {
  const { t, lang, setLang, theme, setTheme } = usePrefs()
  const [tab, setTab] = useState<Tab>(fromHash)
  const [modal, setModal] = useState(false)
  const [text, setText] = useState(() => JSON.stringify(sampleConfigs[0].config, null, 2))
  useEffect(() => { const h = () => setTab(fromHash()); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h) }, [])
  const go = (x: Tab) => { history.replaceState(null, '', `#${x}`); setTab(x); scrollTo({ top: 0 }) }
  const tabs = [
    { value: 'simulador' as const, label: t.tabSim, Icon: Swords },
    { value: 'auditor' as const, label: t.tabAudit, Icon: ScanSearch },
    { value: 'gobernanza' as const, label: t.tabGov, Icon: Landmark },
  ]

  return (
    <div className="grid-bg min-h-full">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[26rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--slate-400)/0.07),transparent)]" />
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[87.5rem] items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/[0.1] bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgb(var(--white)/0.08)]"><Shield size={16} strokeWidth={2} /></div>
            <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-white">MCP-Shield</span>
          </div>
          <nav aria-label={t.navLabel} className="ml-3 hidden md:block"><Segmented label={t.navLabel} options={tabs} value={tab} onChange={go} /></nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setModal(true)} className="press focus-ring inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-[0.75rem] font-medium text-slate-300 hover:bg-white/[0.06]">
              <span aria-hidden className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 rounded-full bg-emerald-400" /></span>
              <span className="hidden lg:inline">{t.badgeLong}</span><span className="lg:hidden">{t.badgeShort}</span>
            </button>
            <div className="flex items-center gap-1.5"><Languages size={15} strokeWidth={1.8} className="hidden text-slate-400 sm:block" aria-hidden />
              <Segmented size="sm" label={t.langLabel} value={lang} onChange={setLang} options={[{ value: 'es', label: 'ES' }, { value: 'en', label: 'EN' }]} /></div>
            <Segmented size="sm" iconOnly label={t.themeLabel} value={theme} onChange={setTheme}
              options={[{ value: 'light', label: t.themeLight, Icon: Sun }, { value: 'dark', label: t.themeDark, Icon: Moon }]} />
          </div>
        </div>
        <nav aria-label={t.navLabel} className="border-t border-white/[0.05] px-3 py-2 md:hidden"><Segmented full label={t.navLabel} options={tabs} value={tab} onChange={go} /></nav>
      </header>
      <main className="relative mx-auto max-w-[87.5rem] px-4 py-5 sm:px-6 sm:py-7">
        {tab === 'simulador' && <Simulator onAudit={j => { setText(j); go('auditor') }} />}
        {tab === 'auditor' && <Auditor text={text} setText={setText} />}
        {tab === 'gobernanza' && <Governance />}
      </main>
      <footer className="mx-auto max-w-[87.5rem] px-6 pb-8 text-[0.75rem] text-slate-400">{t.footer}</footer>
      <ZeroTelemetryModal open={modal} onClose={() => setModal(false)} />
    </div>
  )
}
