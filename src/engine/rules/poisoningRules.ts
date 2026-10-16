import type { Rule, Finding, Severity } from '../../types/mcp.types'
import { pick } from '../../i18n/lang'
import { mk } from './util'

const SIGNALS: { re: RegExp; es: string; en: string; sev: Severity }[] = [
  { re: /<\s*(important|system|secret|instructions?)\s*>/i, es: 'etiqueta de directiva oculta', en: 'hidden directive tag', sev: 'critical' },
  { re: /ignore (all )?(previous|prior|above) instructions/i, es: 'override de instrucciones', en: 'instruction override', sev: 'critical' },
  { re: /(do not|don't|never) (tell|mention|inform|show)( the)? user|no (lo|se lo) (menciones|digas)/i, es: 'ocultación al usuario', en: 'concealment from the user', sev: 'critical' },
  { re: /(~\/\.ssh|id_rsa|\.env\b|\.aws\/credentials|mcp\.json)/i, es: 'referencia a fichero sensible', en: 'sensitive file reference', sev: 'critical' },
  { re: /\b(bcc|exfiltrat|send .* to http|curl |base64)/i, es: 'canal de exfiltración', en: 'exfiltration channel', sev: 'high' },
  { re: /(instead of|rather than) (using|calling) .*tool|when .* tool .* (is|gets) (called|used)/i, es: 'shadowing de otra herramienta', en: 'shadowing of another tool', sev: 'high' },
  { re: /[\u200B-\u200F\u2060\uFEFF]/, es: 'caracteres invisibles (zero-width)', en: 'invisible (zero-width) characters', sev: 'high' },
]

export const toolPoisoning: Rule = {
  id: 'MCPS-TP-001', category: 'tool-poisoning', name: { es: 'Tool Poisoning en descripción', en: 'Tool Poisoning in description' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    ;(server.tools ?? []).forEach((t, i) => {
      const text = `${t.description ?? ''} ${JSON.stringify(t.inputSchema ?? {})}`
      const hits = SIGNALS.filter(s => s.re.test(text))
      if (!hits.length) return
      const worst: Severity = hits.some(h => h.sev === 'critical') ? 'critical' : 'high'
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

const SHADOW = /(cualquier servidor|any (other )?server|all servers|de otro servidor|other tools?|otras herramientas|whenever .*(send_email|create_pull_request|write_file)|cuando se use la tool|whenever the .* tool)/i

export const toolShadowing: Rule = {
  id: 'MCPS-TP-002', category: 'tool-poisoning', name: { es: 'Cross-server tool shadowing', en: 'Cross-server tool shadowing' },
  check: ({ serverName, server, lang }) => (server.tools ?? []).flatMap((t, i) => {
    const m = (t.description ?? '').match(SHADOW)
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
