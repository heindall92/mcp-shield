import type { Rule, Finding, Severity } from '../../types/mcp.types'
import { mk } from './util'

const SIGNALS: { re: RegExp; label: string; sev: Severity }[] = [
  { re: /<\s*(important|system|secret|instructions?)\s*>/i, label: 'etiqueta de directiva oculta', sev: 'critical' },
  { re: /ignore (all )?(previous|prior|above) instructions/i, label: 'override de instrucciones', sev: 'critical' },
  { re: /(do not|don't|never) (tell|mention|inform|show)( the)? user/i, label: 'ocultación al usuario', sev: 'critical' },
  { re: /(~\/\.ssh|id_rsa|\.env\b|\.aws\/credentials|mcp\.json)/i, label: 'referencia a fichero sensible', sev: 'critical' },
  { re: /\b(bcc|exfiltrat|send .* to http|curl |base64)/i, label: 'canal de exfiltración', sev: 'high' },
  { re: /(instead of|rather than) (using|calling) .*tool|when .* tool .* (is|gets) (called|used)/i, label: 'shadowing de otra herramienta', sev: 'high' },
  { re: /[\u200B-\u200F\u2060\uFEFF]/, label: 'caracteres invisibles (zero-width)', sev: 'high' },
]

export const toolPoisoning: Rule = {
  id: 'MCPS-TP-001', category: 'tool-poisoning', name: 'Tool Poisoning en descripción',
  check: ({ serverName, server }) => {
    const out: Finding[] = []
    ;(server.tools ?? []).forEach((t, i) => {
      const text = `${t.description ?? ''} ${JSON.stringify(t.inputSchema ?? {})}`
      const hits = SIGNALS.filter(s => s.re.test(text))
      if (!hits.length) return
      const worst: Severity = hits.some(h => h.sev === 'critical') ? 'critical' : 'high'
      const m = text.match(hits[0].re)
      out.push(mk({
        ruleId: 'MCPS-TP-001', category: 'tool-poisoning', severity: worst, server: serverName,
        title: `Herramienta "${t.name}" con directivas ocultas para el LLM`,
        detail: `Señales: ${hits.map(h => h.label).join(', ')}. El usuario ve un resumen inocuo; el modelo recibe la descripción completa y la obedece.`,
        evidence: (m ? text.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + 90) : text.slice(0, 110)).trim() + '…',
        location: `mcpServers.${serverName}.tools[${i}].description`,
        remediation: 'Elimina el servidor, fija el hash del inventario de herramientas (tool pinning) y muestra al usuario la descripción completa antes de aprobar.',
        cwe: 'CWE-1427',
      }))
    })
    return out
  },
}

const SHADOW = /(cualquier servidor|any (other )?server|all servers|de otro servidor|other tools?|otras herramientas|whenever .*(send_email|create_pull_request|write_file)|cuando se use la tool)/i

export const toolShadowing: Rule = {
  id: 'MCPS-TP-002', category: 'tool-poisoning', name: 'Cross-server tool shadowing',
  check: ({ serverName, server }) => (server.tools ?? []).flatMap((t, i) => {
    const m = (t.description ?? '').match(SHADOW)
    return m ? [mk({
      ruleId: 'MCPS-TP-002', category: 'tool-poisoning', severity: 'critical', server: serverName,
      title: `"${t.name}" intenta modificar herramientas de otros servidores`,
      detail: 'La descripción da instrucciones sobre tools ajenas: el servidor no necesita ser invocado para secuestrar el comportamiento de uno legítimo.',
      evidence: m[0], location: `mcpServers.${serverName}.tools[${i}].description`,
      remediation: 'Aísla el contexto por servidor, usa namespacing de tools y elimina el servidor.', cwe: 'CWE-1427',
    })] : []
  }),
}

export const poisoningRules: Rule[] = [toolPoisoning, toolShadowing]
