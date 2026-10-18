import type { Finding, ScanResult } from '../types/mcp.types'
import type { Lang } from '../i18n/lang'
import { redactString } from './redact'
import { lineFor } from './sarifExporter'
import { VERSION } from '../meta'

/**
 * «yrd-ecosistema» envelope (version 1): the exchange format shared by the author's GRC tools.
 * The user moves the file by hand (CTEM-Nexus → Ecosistema); no tool talks to another over the network.
 * Contract: https://github.com/heindall92/ctem-nexus/blob/main/docs/ECOSISTEMA.md
 */
export const ECO_FORMAT = 'yrd-ecosistema'
export const ECO_VERSION = 1
export const ECO_TOOL = 'mcp-shield'

/** One finding as it travels: identifiers, severity and redacted text only (never a secret value). */
export interface EcoFinding {
  ruleId: string
  category: Finding['category']
  severity: Finding['severity']
  server: string
  title: string
  detail: string
  remediation: string
  evidence: string
  location: string
  line: number
  cwe?: string
}

export interface EcoEnvelope {
  format: typeof ECO_FORMAT
  version: typeof ECO_VERSION
  origen: { herramienta: typeof ECO_TOOL; version: string; generado: string }
  tipo: 'hallazgos'
  proyecto: string
  datos: EcoFinding[]
  resumen: {
    archivo: string
    idioma: Lang
    riesgo: number
    nota: ScanResult['grade']
    completo: boolean
    servidores: number
    recuento: ScanResult['counts']
  }
}

/** File name without path or control characters, as CTEM-Nexus shows it (max 120). */
const printable = (s: string) => [...s].filter(c => c >= ' ' && c !== '\u007f').join('')
const safeName = (s: string) => printable(s.split(/[\\/]/).pop() ?? '').trim().slice(0, 120) || 'mcp.json'

/** Scan result → «hallazgos» envelope for CTEM-Nexus. Every text goes through redactString, like SARIF. */
export function toEcosystem(res: ScanResult, fileName = 'mcp.json', lang: Lang = 'es', sourceText?: string, now: Date = new Date()): EcoEnvelope {
  const file = safeName(fileName)
  return {
    format: ECO_FORMAT,
    version: ECO_VERSION,
    origen: { herramienta: ECO_TOOL, version: VERSION, generado: now.toISOString().replace(/\.\d{3}Z$/, 'Z') },
    tipo: 'hallazgos',
    proyecto: file,
    datos: res.findings.map(f => ({
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      server: redactString(f.server).slice(0, 120),
      title: redactString(f.title).slice(0, 200),
      detail: redactString(f.detail).slice(0, 600),
      remediation: redactString(f.remediation).slice(0, 600),
      evidence: redactString(f.evidence).slice(0, 400),
      location: redactString(f.location).slice(0, 200),
      line: lineFor(sourceText, f.location),
      ...(f.cwe ? { cwe: f.cwe } : {}),
    })),
    resumen: {
      archivo: file,
      idioma: lang,
      riesgo: res.riskScore,
      nota: res.grade,
      completo: res.complete,
      servidores: res.serversScanned,
      recuento: { ...res.counts },
    },
  }
}
