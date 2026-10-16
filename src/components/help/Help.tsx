import { useEffect, useState } from 'react'
import { REPO, VERSION, modKey } from '../../meta'
import { Search, Route, MessageCircleQuestion, ListChecks, Keyboard, ShieldCheck, Info, Layers, FolderGit2, ExternalLink, BookOpen, Bug, ChevronDown, Scale, Award, Radio, Fingerprint } from 'lucide-react'
import { usePrefs } from '../../i18n/prefs'
import { pick } from '../../i18n/lang'
import { ZeroTelemetryFigure } from '../iso/ZeroTelemetryFigure'
import { INT_RULES } from '../../integrity/rules/integrityRules'
import { intHelp } from '../../i18n/integrity'


const RULES: [string, string, string][] = [
  ['MCPS-SC-001', 'Paquete sin versión fijada (npx -y / uvx)', 'Unpinned package (npx -y / uvx)'],
  ['MCPS-SC-002', 'Publisher npm sin scope verificable', 'npm publisher without a verifiable scope'],
  ['MCPS-SC-003', 'Servidor remoto sin TLS', 'Remote server without TLS'],
  ['MCPS-FS-001', 'Exposición excesiva del sistema de ficheros', 'Excessive filesystem exposure'],
  ['MCPS-FS-002', 'mcp-server-git < 2025.12.18 (CVE-2025-68144)', 'mcp-server-git < 2025.12.18 (CVE-2025-68144)'],
  ['MCPS-FS-003', 'Contenedor sin aislamiento', 'Container without isolation'],
  ['MCPS-SEC-001', 'Secreto en env, headers o URL', 'Secret in env, headers or URL'],
  ['MCPS-SEC-002', 'Secreto en argumentos CLI', 'Secret in CLI arguments'],
  ['MCPS-TP-001', 'Tool Poisoning en la descripción', 'Tool Poisoning in the description'],
  ['MCPS-TP-002', 'Cross-server tool shadowing', 'Cross-server tool shadowing'],
  ['MCPS-TP-003', 'ASCII smuggling: Unicode Tag, selectores de variación, Sneaky Bits y ANSI', 'ASCII smuggling: Unicode Tag, variation selectors, Sneaky Bits and ANSI'],
  ...INT_RULES.map(r => [r.id, r.name.es, r.name.en] as [string, string, string]),
]
const SUITE: [string, string, string, string][] = [
  ['Rosetta', 'Mapa multinorma: ENS, ISO/IEC 27001, NIS2, ISO/IEC 42001…', 'Multi-standard map: ENS, ISO/IEC 27001, NIS2, ISO/IEC 42001…', 'https://heindall92.github.io/rosetta_multinorma/'],
  ['GRC ENS Compliance Studio', 'Categorización ENS, MAGERIT y SoA viva', 'ENS categorisation, MAGERIT and a living SoA', 'https://heindall92.github.io/grc_ens_compliance_studio/'],
  ['CTEM-Nexus', 'Gestión continua de la exposición a amenazas', 'Continuous threat exposure management', 'https://heindall92.github.io/ctem-nexus/'],
  ['Auditor LLM', 'Pruebas de prompt injection y fuga de datos', 'Prompt-injection and data-leak testing', 'https://heindall92.github.io/auditor_llm/'],
  ['Kairos', 'BIA, BCP y DRP con ruta crítica', 'BIA, BCP and DRP with critical path', 'https://heindall92.github.io/kairos/'],
  ['Argos GRC', 'Laboratorio de práctica GRC', 'GRC practice lab', 'https://heindall92.github.io/argos-grc/'],
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const

export function Help({ initial }: { initial?: string }) {
  const { t, lang } = usePrefs()
  const L = (es: string, en: string) => pick(lang, es, en)
  const [q, setQ] = useState('')
  const keys: [string[], string][] = [[[modKey(), 'K'], t.kPalette], [['/'], t.kSearch], [['?'], t.kHelp], [['1', '2', '3', '4', '5'], t.kTabs], [['T'], t.kTheme], [['L'], t.kLang], [['Esc'], t.kEsc]]
  const sections = [
    { id: 'uso', title: t.hHow, Icon: Route, text: t.hHowItems.join(' '), body: <ul className="space-y-1.5">{t.hHowItems.map(x => <li key={x}>{x}</li>)}</ul> },
    { id: 'telemetria', title: t.figHow, Icon: Radio, text: `${t.figTitle} ${t.figCaption}`, body: <ZeroTelemetryFigure /> },
    { id: 'integridad', title: intHelp(lang).title, Icon: Fingerprint, text: intHelp(lang).items.join(' '), body: <ul className="list-disc space-y-1.5 pl-4">{intHelp(lang).items.map(x => <li key={x}>{x}</li>)}</ul> },
    { id: 'faq', title: t.hFaq, Icon: MessageCircleQuestion, text: t.hFaqItems.flat().join(' '), body: <div className="space-y-1.5">{t.hFaqItems.map(([qq, a]) => (
      <details key={qq} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-white">{qq}<ChevronDown size={15} className="ml-auto shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden /></summary>
        <p className="mt-2 text-slate-300">{a}</p></details>))}</div> },
    { id: 'reglas', title: t.hRules, Icon: ListChecks, text: RULES.flat().join(' '), body: <ul className="grid gap-1.5 sm:grid-cols-2">{RULES.map(([id, es, en]) => <li key={id} className="flex gap-2"><code className="shrink-0 text-[0.75rem] text-slate-400">{id}</code><span>{L(es, en)}</span></li>)}</ul> },
    { id: 'atajos', title: t.hKeys, Icon: Keyboard, text: keys.map(k => k[1]).join(' '), body: <dl className="grid gap-2 sm:grid-cols-2">{keys.map(([k, d]) => <div key={d} className="flex items-center gap-3"><dt className="flex shrink-0 gap-1">{k.map(x => <kbd key={x} className="kbd">{x}</kbd>)}</dt><dd>{d}</dd></div>)}</dl> },
    { id: 'privacidad', title: t.hPrivacy, Icon: ShieldCheck, text: t.hPrivacyItems.join(' '), body: <ul className="list-disc space-y-1.5 pl-4">{t.hPrivacyItems.map(x => <li key={x}>{x}</li>)}</ul> },
    { id: 'legal', title: t.hLegal, Icon: Scale, text: t.hLegalItems.join(' '), body: <ul className="list-disc space-y-1.5 pl-4">{t.hLegalItems.map(x => <li key={x}>{x}</li>)}</ul> },
    { id: 'creditos', title: t.hCredits, Icon: Award, text: t.hCreditsItems.flat().join(' '), body: <ul className="space-y-1.5">{t.hCreditsItems.map(([n, d, url]) => <li key={n}>{url ? <a {...ext} href={url} className="focus-ring rounded font-medium text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">{n}</a> : <b className="text-white">{n}</b>} · {d}</li>)}</ul> },
    { id: 'acerca', title: t.hAbout, Icon: Info, text: `${t.hAboutBody} ${t.hSuite} ${SUITE.map(s => s.join(' ')).join(' ')}`, body: <div className="space-y-4">
      <p>{t.hAboutBody}</p>
      <p className="text-slate-400">{t.version} {VERSION} · MIT</p>
      <div className="flex flex-wrap gap-2">
        <a {...ext} href={REPO} className="btn-ghost focus-ring text-[0.8125rem]"><FolderGit2 size={14} aria-hidden />{t.hRepo}<ExternalLink size={12} aria-hidden /></a>
        <a {...ext} href={`${REPO}/blob/main/docs/SOURCES.md`} className="btn-ghost focus-ring text-[0.8125rem]"><BookOpen size={14} aria-hidden />{t.hSources}<ExternalLink size={12} aria-hidden /></a>
        <a {...ext} href={`${REPO}/blob/main/SECURITY.md`} className="btn-ghost focus-ring text-[0.8125rem]"><Bug size={14} aria-hidden />{t.hSecurity}<ExternalLink size={12} aria-hidden /></a>
      </div>
      <div><h3 className="mb-2 flex items-center gap-2 text-[0.875rem] font-semibold text-white"><Layers size={15} aria-hidden />{t.hSuite}</h3>
        <ul className="grid gap-2 sm:grid-cols-2">{SUITE.map(([n, es, en, url]) => <li key={n}><a {...ext} href={url} className="press focus-ring block rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 hover:bg-white/[0.05]">
          <span className="flex items-center gap-1.5 font-medium text-white">{n}<ExternalLink size={12} className="text-slate-400" aria-hidden /></span><span className="text-[0.8125rem] text-slate-400">{L(es, en)}</span></a></li>)}</ul></div>
    </div> },
  ]
  useEffect(() => { if (initial) requestAnimationFrame(() => document.getElementById(`h-${initial}`)?.scrollIntoView({ block: 'start' })) }, [initial])
  const ORDER = ['uso', 'telemetria', 'reglas', 'faq', 'atajos', 'privacidad', 'legal', 'creditos', 'acerca']
  sections.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  const shown = sections.filter(s => !q.trim() || norm(`${s.title} ${s.text}`).includes(norm(q.trim())))
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-slate-400">{t.helpKicker}</p>
        <h1 className="display mt-1.5 text-white">{t.helpTitle}</h1>
      </div>
      <label className="flex max-w-xl items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 focus-within:border-white/[0.2]">
        <Search size={16} className="text-slate-400" aria-hidden />
        <input id="help-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t.helpSearch} aria-label={t.helpSearch} className="h-10 flex-1 bg-transparent text-[0.875rem] text-white outline-none placeholder:text-slate-400" />
      </label>
      <nav aria-label={t.helpTitle} className="flex flex-wrap gap-1.5">{shown.map(s => <a key={s.id} href={`#ayuda/${s.id}`} onClick={e => { e.preventDefault(); document.getElementById(`h-${s.id}`)?.scrollIntoView({ block: 'start' }) }} className="btn-chip focus-ring"><s.Icon size={13} aria-hidden />{s.title}</a>)}</nav>
      {!shown.length && <div className="card p-8 text-center text-sm text-slate-400"><Search size={22} className="mx-auto mb-2" aria-hidden />{t.helpNoRes}</div>}
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map(s => (
          <section key={s.id} id={`h-${s.id}`} data-initial={s.id === initial || undefined} className={`card scroll-mt-28 p-5 text-[0.875rem] leading-relaxed text-slate-300 ${s.id === 'acerca' || s.id === 'faq' || s.id === 'telemetria' ? 'lg:col-span-2' : ''}`}>
            <h2 className="mb-3 flex items-center gap-2 text-[1rem] font-semibold text-white"><s.Icon size={16} strokeWidth={1.8} aria-hidden />{s.title}</h2>
            {s.body}
          </section>))}
      </div>
    </div>
  )
}
