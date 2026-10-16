import type { Rule, Finding, Severity } from '../../types/mcp.types'
import { pick } from '../../i18n/lang'
import { mk } from './util'

/** Cap analysed text so a pathological description cannot stall the regex engine. */
const MAX_DESC = 20_000

const SIGNALS: { re: RegExp; es: string; en: string; sev: Severity }[] = [
  { re: /<\s*(important|system|secret|instructions?)\s*>/i, es: 'etiqueta de directiva oculta', en: 'hidden directive tag', sev: 'critical' },
  { re: /ignore (all )?(previous|prior|above) instructions/i, es: 'override de instrucciones', en: 'instruction override', sev: 'critical' },
  { re: /(do not|don't|never) (tell|mention|inform|show)( the)? user|no (lo|se lo) (menciones|digas)/i, es: 'ocultación al usuario', en: 'concealment from the user', sev: 'critical' },
  { re: /(~\/\.ssh|id_rsa|\.env\b|\.aws\/credentials|mcp\.json)/i, es: 'referencia a fichero sensible', en: 'sensitive file reference', sev: 'critical' },
  { re: /\b(exfiltrat|bcc[: ]|send .{0,80} to https?:)/i, es: 'canal de exfiltración', en: 'exfiltration channel', sev: 'high' },
  { re: /\b(curl |wget |base64)/i, es: 'comando de red/codificación', en: 'network/encoding command', sev: 'medium' },
  { re: /(instead of|rather than) (using|calling) .*tool|when .* tool .* (is|gets) (called|used)/i, es: 'shadowing de otra herramienta', en: 'shadowing of another tool', sev: 'high' },
  { re: /[\u200B-\u200F\u2060\uFEFF]/, es: 'caracteres invisibles (zero-width)', en: 'invisible (zero-width) characters', sev: 'high' },
]

export const toolPoisoning: Rule = {
  id: 'MCPS-TP-001', category: 'tool-poisoning', surface: 'tools', name: { es: 'Tool Poisoning en descripción', en: 'Tool Poisoning in description' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    ;(server.tools ?? []).forEach((t, i) => {
      const text = `${t.description ?? ''} ${JSON.stringify(t.inputSchema ?? {})}`.slice(0, MAX_DESC)
      const hits = SIGNALS.filter(s => s.re.test(text))
      if (!hits.length) return
      const worst: Severity = hits.some(h => h.sev === 'critical') ? 'critical' : hits.some(h => h.sev === 'high') || hits.length > 1 ? 'high' : 'medium'
      const m = text.match(hits[0].re)
      out.push(mk({
        ruleId: 'MCPS-TP-001', category: 'tool-poisoning', severity: worst, server: serverName,
        title: L(`Herramienta "${t.name}" con directivas ocultas para el LLM`, `Tool "${t.name}" carries hidden directives for the LLM`),
        detail: L(`Señales: ${hits.map(h => h.es).join(', ')}. El usuario ve un resumen inocuo; el modelo recibe la descripción completa y la obedece.`,
          `Signals: ${hits.map(h => h.en).join(', ')}. The user sees a harmless summary; the model receives the full description and obeys it.`),
        evidence: (m ? text.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + 90) : text.slice(0, 110)).trim() + '…',
        location: `mcpServers.${serverName}.tools[${i}].description`,
        remediation: L('Elimina el servidor, fija el hash del inventario de herramientas (tool pinning) y muestra al usuario la descripción completa antes de aprobar.', 'Remove the server, pin the hash of the tool inventory (tool pinning) and show the user the full description before approval.'),
        cwe: 'CWE-1427',
      }))
    })
    return out
  },
}

const SHADOW = /((when|whenever|before|after|if)\b.{0,80}\b(any other|another|other|all) (servers?|tools?)\b.{0,40}\b(is |are |gets? )?(called|used|invoked)|(cuando|siempre que|antes de)\b.{0,80}\b(otro servidor|otras herramientas|cualquier servidor)|\b(any|all) (other )?servers?'? tools?\b.{0,60}\b(must|should|always)|(whenever|when) .{0,60}\b(send_email|create_pull_request|write_file)\b.{0,20}(is |gets? )?(called|used|invoked)|cuando se use la tool)/i

export const toolShadowing: Rule = {
  id: 'MCPS-TP-002', category: 'tool-poisoning', surface: 'tools', name: { es: 'Cross-server tool shadowing', en: 'Cross-server tool shadowing' },
  check: ({ serverName, server, lang }) => (server.tools ?? []).flatMap((t, i) => {
    const m = (t.description ?? '').slice(0, MAX_DESC).match(SHADOW)
    const L = (es: string, en: string) => pick(lang, es, en)
    return m ? [mk({
      ruleId: 'MCPS-TP-002', category: 'tool-poisoning', severity: 'critical', server: serverName,
      title: L(`"${t.name}" intenta modificar herramientas de otros servidores`, `"${t.name}" tries to alter tools from other servers`),
      detail: L('La descripción da instrucciones sobre tools ajenas: el servidor no necesita ser invocado para secuestrar el comportamiento de uno legítimo.', "The description gives instructions about other servers' tools: it does not need to be invoked to hijack a legitimate one."),
      evidence: m[0], location: `mcpServers.${serverName}.tools[${i}].description`,
      remediation: L('Aísla el contexto por servidor, usa namespacing de tools y elimina el servidor.', 'Isolate context per server, namespace tools and remove the server.'), cwe: 'CWE-1427',
    })] : []
  }),
}

export const poisoningRules: Rule[] = [toolPoisoning, toolShadowing]
