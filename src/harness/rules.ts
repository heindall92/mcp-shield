import type { HarnessRuleMeta } from './types'
import type { Lang } from '../i18n/lang'

/**
 * Rule catalogue. OWASP Top 10 for LLM Applications 2025 ids and ISO/IEC 42001:2023 Annex A control ids.
 * The mapping is orientative (MCP-Shield's own reading, not an official crosswalk).
 */
export const HS_RULES: HarnessRuleMeta[] = [
  { id: 'AHS-01', name: { es: 'Unicode invisible o bidireccional (Trojan Source, Unicode Tags)', en: 'Invisible or bidirectional Unicode (Trojan Source, Unicode Tags)' }, owasp: 'LLM01:2025', owaspName: { es: 'Inyección de prompt', en: 'Prompt Injection' }, iso: ['A.6.2.4'], cwe: 'CWE-1427' },
  { id: 'AHS-02', name: { es: 'Secuestro de instrucciones y comentarios ocultos', en: 'Instruction hijack and hidden comments' }, owasp: 'LLM01:2025', owaspName: { es: 'Inyección de prompt', en: 'Prompt Injection' }, iso: ['A.6.2.4'], cwe: 'CWE-1427' },
  { id: 'AHS-03', name: { es: 'Exfiltración por red en hooks y scripts', en: 'Network exfiltration in hooks and scripts' }, owasp: 'LLM02:2025', owaspName: { es: 'Divulgación de información sensible', en: 'Sensitive Information Disclosure' }, iso: ['A.6.2.4', 'A.6.2.6'], cwe: 'CWE-200' },
  { id: 'AHS-04', name: { es: 'Dependencias MCP sin fijar (.mcp.json)', en: 'Unpinned MCP dependencies (.mcp.json)' }, owasp: 'LLM03:2025', owaspName: { es: 'Cadena de suministro', en: 'Supply Chain' }, iso: ['A.10.3'], cwe: 'CWE-829' },
  { id: 'AHS-05', name: { es: 'Lectura de ficheros sensibles o volcado de credenciales', en: 'Sensitive host files or credential dumps' }, owasp: 'LLM02:2025', owaspName: { es: 'Divulgación de información sensible', en: 'Sensitive Information Disclosure' }, iso: ['A.6.2.4'], cwe: 'CWE-522' },
  { id: 'AHS-06', name: { es: 'Descarga y ejecución remota (curl | sh, iex)', en: 'Remote download and execute (curl | sh, iex)' }, owasp: 'LLM03:2025', owaspName: { es: 'Cadena de suministro', en: 'Supply Chain' }, iso: ['A.10.3', 'A.6.2.4'], cwe: 'CWE-494' },
  { id: 'AHS-07', name: { es: 'Payload ofuscado (base64) que se decodifica y ejecuta', en: 'Obfuscated (base64) payload decoded and executed' }, owasp: 'LLM03:2025', owaspName: { es: 'Cadena de suministro', en: 'Supply Chain' }, iso: ['A.6.2.4'], cwe: 'CWE-506' },
  { id: 'AHS-08', name: { es: 'Aprobación automática o permisos desactivados', en: 'Auto-approval or permission bypass' }, owasp: 'LLM06:2025', owaspName: { es: 'Agencia excesiva', en: 'Excessive Agency' }, iso: ['A.9.2'], cwe: 'CWE-250' },
]
export const hsRule = (id: string) => HS_RULES.find(r => r.id === id)!

/** ISO/IEC 42001:2023 Annex A controls used by the rules (titles as in the standard). */
export const ISO_TITLES: Record<string, { es: string; en: string }> = {
  'A.6.2.4': { es: 'Verificación y validación del sistema de IA', en: 'AI system verification and validation' },
  'A.6.2.6': { es: 'Operación y seguimiento del sistema de IA', en: 'AI system operation and monitoring' },
  'A.9.2': { es: 'Procesos para el uso responsable de sistemas de IA', en: 'Processes for responsible use of AI systems' },
  'A.10.3': { es: 'Proveedores', en: 'Suppliers' },
}
export const isoLabel = (id: string, lang: Lang) => `${id} · ${ISO_TITLES[id]?.[lang] ?? ''}`.replace(/ · $/, '')
