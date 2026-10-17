import { useEffect, useState } from 'react'
import { REPO, VERSION, modKey } from '../../meta'
import { Search, Route, MessageCircleQuestion, ListChecks, Keyboard, ShieldCheck, Info, Layers, FolderGit2, ExternalLink, BookOpen, Bug, ChevronDown, Scale, Award, Radio, Fingerprint, Workflow } from 'lucide-react'
import { usePrefs } from '../../i18n/prefs'
import { pick } from '../../i18n/lang'
import { ZeroTelemetryFigure } from '../iso/ZeroTelemetryFigure'
import { INT_RULES } from '../../integrity/rules/integrityRules'
import { intHelp } from '../../i18n/integrity'


const RULES: [string, string, string][] = [
  ['MCPS-SC-001', 'Paquete sin versión fijada (npx -y / uvx / npm exec / dlx)', 'Unpinned package (npx -y / uvx / npm exec / dlx)'],
  ['MCPS-SC-002', 'Publisher npm sin scope verificable', 'npm publisher without a verifiable scope'],
  ['MCPS-SC-003', 'Servidor remoto sin TLS', 'Remote server without TLS'],
  ['MCPS-SC-004', 'Imagen de contenedor sin fijar por digest', 'Container image not pinned by digest'],
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
/** Ecosystem (same list in every tool of the author). web: null when there is no published site. */
const ECO: { n: string; es: string; en: string; repo: string; web: string | null }[] = [
  { n: 'Rosetta Multinorma', es: '16 normas y leyes sobre 152 controles unificados', en: '16 frameworks and laws over 152 unified controls', repo: 'rosetta_multinorma', web: 'https://heindall92.github.io/rosetta_multinorma/' },
  { n: 'ENS Compliance Studio', es: 'Categorización ENS, MAGERIT y declaración de aplicabilidad', en: 'ENS categorisation, MAGERIT and statement of applicability', repo: 'grc_ens_compliance_studio', web: 'https://heindall92.github.io/grc_ens_compliance_studio/' },
  { n: 'CTEM-Nexus', es: 'Exposición técnica y rutas de ataque hacia los activos críticos', en: 'Technical exposure and attack paths to critical assets', repo: 'ctem-nexus', web: 'https://heindall92.github.io/ctem-nexus/' },
  { n: 'KAIROS', es: 'Continuidad: BIA, BCP, DRP y ruta crítica', en: 'Continuity: BIA, BCP, DRP and critical path', repo: 'kairos', web: 'https://heindall92.github.io/kairos/' },
  { n: 'ENS AD Auditor', es: 'Directorio Activo frente a las medidas del ENS', en: 'Active Directory against the ENS measures', repo: 'ens_ad-auditor', web: 'https://heindall92.github.io/ens_ad-auditor/' },
  { n: 'ARGOS', es: 'Laboratorio GRC con rutas, máquinas y simulacros', en: 'GRC lab with paths, machines and drills', repo: 'argos-grc', web: 'https://heindall92.github.io/argos-grc/' },
  { n: 'Norvik', es: 'Gobernanza: roles, políticas y el marco que une al resto', en: 'Governance: roles, policies and the framework that ties the rest', repo: 'Norvik_Gobernanza', web: null },
]
const AI_TOOL = { n: 'Auditor LLM', es: 'Pruebas de prompt injection y fuga de datos en LLM', en: 'Prompt-injection and data-leak testing for LLMs', repo: 'auditor_llm', web: 'https://heindall92.github.io/auditor_llm/' }
const GH = 'https://github.com/heindall92/'

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
    { id: 'ecosistema', title: t.hEco, Icon: Workflow, text: `${t.hEcoLead} ${t.hEcoSteps.join(' ')} ${ECO.map(e => `${e.n} ${e.es} ${e.en}`).join(' ')} ${AI_TOOL.n}`, body: <div className="space-y-4" data-testid="eco">
      <p>{t.hEcoLead}</p>
      <ol className="grid gap-2 sm:grid-cols-2">{t.hEcoSteps.map((x, i) => <li key={x} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/[0.15] font-mono text-[0.75rem] font-semibold text-accent">{i + 1}</span><span>{x}</span></li>)}</ol>
      <div><h3 className="mb-2 flex items-center gap-2 text-[0.875rem] font-semibold text-white"><Layers size={15} aria-hidden />{t.hEcoTools}</h3>
        <ul className="grid gap-2 sm:grid-cols-2">{[...ECO, AI_TOOL].map(e => <li key={e.n} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <span className="min-w-[12rem] flex-1"><span className="block font-medium text-white">{e.n}{e === AI_TOOL && <span className="ml-2 text-[0.75rem] font-normal text-slate-400">· {t.hEcoAi}</span>}</span><span className="text-[0.8125rem] text-slate-400">{L(e.es, e.en)}</span></span>
          <span className="flex gap-1.5">{e.web ? <a {...ext} href={e.web} aria-label={`${t.hEcoOpen} ${e.n}`} className="btn-chip focus-ring"><ExternalLink size={12} aria-hidden />{t.hEcoOpen}</a> : <span className="px-1 text-[0.75rem] text-slate-400">{t.hEcoNoWeb}</span>}
            <a {...ext} href={GH + e.repo} aria-label={`${t.hEcoCode} ${e.n}`} className="btn-chip focus-ring"><FolderGit2 size={12} aria-hidden />{t.hEcoCode}</a></span></li>)}</ul></div>
    </div> },
    { id: 'acerca', title: t.hAbout, Icon: Info, text: `${t.hAboutBody} ${t.version} ${VERSION}`, body: <div className="space-y-4">
      <p>{t.hAboutBody}</p>
      <p className="text-slate-400">{t.version} {VERSION} · MIT</p>
      <div className="flex flex-wrap gap-2">
        <a {...ext} href={REPO} className="btn-ghost focus-ring text-[0.8125rem]"><FolderGit2 size={14} aria-hidden />{t.hRepo}<ExternalLink size={12} aria-hidden /></a>
        <a {...ext} href={`${REPO}/blob/main/docs/SOURCES.md`} className="btn-ghost focus-ring text-[0.8125rem]"><BookOpen size={14} aria-hidden />{t.hSources}<ExternalLink size={12} aria-hidden /></a>
        <a {...ext} href={`${REPO}/blob/main/SECURITY.md`} className="btn-ghost focus-ring text-[0.8125rem]"><Bug size={14} aria-hidden />{t.hSecurity}<ExternalLink size={12} aria-hidden /></a>
        <a href="#ayuda/ecosistema" onClick={e => { e.preventDefault(); document.getElementById('h-ecosistema')?.scrollIntoView({ block: 'start' }) }} className="btn-ghost focus-ring text-[0.8125rem]"><Workflow size={14} aria-hidden />{t.hEco}</a>
      </div>
    </div> },
  ]
  useEffect(() => { if (initial) requestAnimationFrame(() => document.getElementById(`h-${initial}`)?.scrollIntoView({ block: 'start' })) }, [initial])
  const ORDER = ['uso', 'telemetria', 'integridad', 'reglas', 'faq', 'ecosistema', 'atajos', 'privacidad', 'legal', 'creditos', 'acerca']
  sections.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  const shown = sections.filter(s => !q.trim() || norm(`${s.title} ${s.text}`).includes(norm(q.trim())))
  return (
    <div className="space-y-4">
      <div>
        <p className="kicker">{t.helpKicker}</p>
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
          <section key={s.id} id={`h-${s.id}`} data-initial={s.id === initial || undefined} className={`card scroll-mt-28 p-5 text-[0.875rem] leading-relaxed text-slate-300 ${s.id === 'acerca' || s.id === 'faq' || s.id === 'telemetria' || s.id === 'ecosistema' ? 'lg:col-span-2' : ''}`}>
            <h2 className="mb-3 flex items-center gap-2 text-[1rem] font-semibold text-white"><s.Icon size={16} strokeWidth={1.8} aria-hidden />{s.title}</h2>
            {s.body}
          </section>))}
      </div>
    </div>
  )
}
