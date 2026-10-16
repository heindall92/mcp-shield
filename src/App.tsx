import { useEffect, useState } from 'react'
import { Shield, Swords, ScanSearch, Landmark, WifiOff } from 'lucide-react'
import { Simulator } from './components/simulator/Simulator'
import { Auditor } from './components/auditor/Auditor'
import { Governance } from './components/governance/Governance'
import { ZeroTelemetryModal } from './components/ui/ZeroTelemetry'
import { sampleConfigs } from './data/sampleConfigs'

type Tab = 'simulador' | 'auditor' | 'gobernanza'
const TABS: { id: Tab; label: string; Icon: typeof Shield }[] = [
  { id: 'simulador', label: 'Simulador', Icon: Swords },
  { id: 'auditor', label: 'Auditor', Icon: ScanSearch },
  { id: 'gobernanza', label: 'Gobernanza', Icon: Landmark },
]
const fromHash = (): Tab => (TABS.find(t => `#${t.id}` === location.hash)?.id ?? 'simulador')

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash)
  const [modal, setModal] = useState(false)
  const [text, setText] = useState(() => JSON.stringify(sampleConfigs[0].config, null, 2))
  useEffect(() => { const h = () => setTab(fromHash()); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h) }, [])
  const go = (t: Tab) => { history.replaceState(null, '', `#${t}`); setTab(t); scrollTo({ top: 0 }) }

  return (
    <div className="grid-bg min-h-full">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,#22d3ee14,transparent)]" />
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#07090d]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#04121a] shadow-[0_0_20px_#22d3ee55]"><Shield size={17} strokeWidth={2.4} /></div>
            <span className="text-[0.9375rem] font-semibold tracking-tight text-white">MCP-Shield</span>
          </div>
          <nav className="ml-2 hidden gap-1 md:flex">
            {TABS.map(({ id, label, Icon }) => <button key={id} onClick={() => go(id)} aria-current={tab === id} className={`tab ${tab === id ? 'tab-on' : ''}`}><Icon size={15} />{label}</button>)}
          </nav>
          <button onClick={() => setModal(true)} className="press ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[0.6875rem] font-semibold text-emerald-300 transition-[background-color,transform] hover:bg-emerald-500/20">
            <WifiOff size={13} /><span className="hidden sm:inline">100% Client-Side Execution | Zero Network Egress</span><span className="sm:hidden">Zero Egress</span>
          </button>
        </div>
        <nav className="flex gap-1 border-t border-white/5 px-3 py-1.5 md:hidden">
          {TABS.map(({ id, label, Icon }) => <button key={id} onClick={() => go(id)} aria-current={tab === id} className={`tab flex-1 justify-center ${tab === id ? 'tab-on' : ''}`}><Icon size={15} />{label}</button>)}
        </nav>
      </header>
      <main className="relative mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">
        {tab === 'simulador' && <Simulator onAudit={j => { setText(j); go('auditor') }} />}
        {tab === 'auditor' && <Auditor text={text} setText={setText} />}
        {tab === 'gobernanza' && <Governance />}
      </main>
      <footer className="mx-auto max-w-[1400px] px-6 pb-8 text-[0.6875rem] text-slate-600">
        Proyecto educativo y defensivo · todos los payloads, claves (sk-FAKE-…, ghp_FAKE…) y hosts son simulados · MIT · Yoandy Ramírez Delgado (heindall92)
      </footer>
      <ZeroTelemetryModal open={modal} onClose={() => setModal(false)} />
    </div>
  )
}
