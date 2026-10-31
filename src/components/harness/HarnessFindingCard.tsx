import { useState } from 'react'
import { ChevronRight, EyeOff, Wrench } from 'lucide-react'
import type { HarnessFinding } from '../../harness/types'
import type { Lang } from '../../i18n/lang'
import { hsStrings } from '../../i18n/harness'
import { UI } from '../../i18n/ui'
import { hsRule, isoLabel } from '../../harness/rules'
import { safeText } from '../../engine/redact'

/**
 * One Harness-Shield finding. File content (snippet, decoded text, file name) is untrusted: it is rendered only
 * as React text nodes (textContent), never as HTML, and invisible code points are already shown as ⟨U+XXXX⟩.
 * Pure props (no context) so it can be rendered in tests.
 */
export function HarnessFindingCard({ f, lang, defaultOpen = false }: { f: HarnessFinding; lang: Lang; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const s = hsStrings(lang), t = UI[lang], r = hsRule(f.ruleId)
  const id = `hs-${f.id.replace(/[^\w-]/g, '-')}`
  return (
    <article data-rule={f.ruleId} className="rounded-xl border border-white/[0.07] bg-white/[0.02] transition-colors hover:border-white/[0.14]">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={id} className="press-soft focus-ring flex w-full items-start gap-2.5 p-3 text-left">
        <span className={`sev-${f.severity} mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase`}>{t.sevNames[f.severity]}</span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[0.8125rem] font-medium text-slate-100">{safeText(f.title)}</span>
          <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-slate-400">{f.ruleId} · {safeText(f.file)}:{f.line} · {s.confidence[f.confidence]}</span>
        </span>
        <ChevronRight size={15} aria-hidden className={`mt-1 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div id={id} className="space-y-2 border-t border-white/5 px-3 pb-3 pt-2 text-[0.78125rem] leading-relaxed text-slate-300">
        <p>{f.detail}</p>
        <div>
          <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-400">{s.snippet} · {s.line} {f.line}</div>
          <pre data-testid="hs-snippet" className="whitespace-pre-wrap break-all rounded-lg bg-black/40 p-2 font-mono text-[0.6875rem] text-amber-200">{f.snippet}</pre>
        </div>
        {f.hidden && <p data-testid="hs-hidden" className="flex items-start gap-1.5 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-2 py-1.5 text-red-100"><EyeOff size={13} className="mt-[0.2rem] shrink-0" aria-hidden /><span><b className="font-semibold">{s.hidden}:</b> <code className="break-all font-mono text-[0.6875rem]">{f.hidden}</code></span></p>}
        <p className="flex items-start gap-1.5"><Wrench size={13} className="mt-[0.2rem] shrink-0 text-emerald-300" aria-hidden /><span><b className="text-emerald-300">{s.fix}:</b> {f.remediation}</span></p>
        <p className="text-[0.6875rem] text-slate-400">OWASP {f.owasp} · {r.owaspName[lang]} · ISO/IEC 42001 {f.iso.map(i => isoLabel(i, lang)).join('; ')}{f.cwe ? ` · ${f.cwe}` : ''} · <i>{s.orientative}</i></p>
      </div>}
    </article>
  )
}
