import type { RuleCategory } from '../types/mcp.types'

/** Mapeo orientativo hallazgo → marcos. Basado en los temas públicos de cada documento (ver docs/SOURCES.md). */
export interface ControlMap { nsa: string; owasp: string; iso: string; csa: string }

export const FRAMEWORKS = [
  { id: 'nsa', name: 'NSA AISC — MCP Security Design Considerations', date: 'CSI, 20 may 2026', url: 'https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf' },
  { id: 'owasp', name: 'OWASP Top 10 for Agentic Applications 2026', date: '9 dic 2025', url: 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/' },
  { id: 'iso', name: 'ISO/IEC 42001:2023 — Sistema de gestión de IA', date: 'Anexo A', url: 'https://www.iso.org/standard/42001' },
  { id: 'csa', name: 'CSA — MCP Security Resource Center', date: 'ago 2025', url: 'https://labs.cloudsecurityalliance.org/mcp/' },
] as const

export const CONTROL_MAP: Record<RuleCategory, ControlMap> = {
  'supply-chain': { nsa: 'Verificar procedencia e integridad de servidores; aprobar cambios de capacidad', owasp: 'ASI04 · Agentic Supply Chain Vulnerabilities', iso: 'A.10 · Relaciones con terceros', csa: 'Top 10 MCP Server Risks · supply chain' },
  filesystem: { nsa: 'Mínimo privilegio y sandboxing de herramientas', owasp: 'ASI02 · Tool Misuse · ASI05 · Unexpected Code Execution', iso: 'A.6 · Ciclo de vida del sistema de IA', csa: 'Top 10 MCP Server Risks · permisos excesivos' },
  secrets: { nsa: 'Gestión del ciclo de vida de tokens y sesiones', owasp: 'ASI03 · Identity & Privilege Abuse', iso: 'A.7 · Datos para sistemas de IA', csa: 'Top 10 MCP Client Risks · credenciales' },
  'tool-poisoning': { nsa: 'Validación estricta de esquemas y contexto; filtrado de salida', owasp: 'ASI01 · Agent Goal Hijack · ASI06 · Memory & Context Poisoning', iso: 'A.9 · Uso de sistemas de IA', csa: 'Top 10 MCP Server Risks · tool poisoning' },
}
