import type { Lang } from './lang'
import type { HarnessKind, Confidence } from '../harness/types'
import type { RejectReason } from '../harness/intake'

const es = {
  kicker: 'Auditor de archivos de agente', title: 'Harness-Shield',
  sub: 'Análisis estático de SKILL.md, CLAUDE.md, AGENTS.md, .cursorrules, .mcp.json y hooks en Bash, Python o PowerShell. Nada se ejecuta: el contenido solo se lee como texto.',
  privacy: 'Los archivos se leen en la memoria de tu navegador y desaparecen al recargar o con «Vaciar». Nada se sube.',
  open: 'Abrir archivos', samples: 'Cargar ejemplos', clear: 'Vaciar', samplesToast: (n: number) => `${n} archivos de ejemplo cargados (maliciosos a propósito)`,
  drop: 'Suelta aquí archivos de configuración de agentes', dropHint: 'Hasta 50 archivos de texto de 5 MB como máximo. Los binarios se rechazan sin leerse.', dropActive: 'Suelta para analizar',
  paste: 'Pegar contenido', pasteName: 'Nombre del archivo', pasteBody: 'Contenido', add: 'Añadir', pasteEmpty: 'Pega primero el contenido.',
  files: 'Archivos', remove: (n: string) => `Quitar ${n}`, lines: (n: number) => `${n} ${n === 1 ? 'línea' : 'líneas'}`,
  kinds: { skill: 'Skill', claude: 'CLAUDE.md', agents: 'AGENTS.md', cursorrules: 'Reglas', mcp: 'MCP', bash: 'Bash', python: 'Python', powershell: 'PowerShell', markdown: 'Markdown', json: 'JSON', config: 'Config', text: 'Texto' } as Record<HarnessKind, string>,
  reject: { size: 'supera 5 MB: no se ha leído', binary: 'parece binario: solo se admiten archivos de texto', empty: 'está vacío', 'too-many': 'se ha superado el límite de 50 archivos', read: 'no se pudo leer' } as Record<RejectReason, string>,
  rejectedTitle: 'Archivos rechazados',
  findings: 'Hallazgos', all: 'Todos', none: 'Sin hallazgos en los archivos cargados. Es un análisis heurístico: revisa igualmente lo que instalas.',
  emptyTitle: 'Carga archivos o los ejemplos', emptyBody: 'Prueba con «Cargar ejemplos»: siete archivos maliciosos con Unicode oculto, comentarios con instrucciones, hooks que exfiltran y un .mcp.json sin fijar.',
  confidence: { high: 'Confianza alta', medium: 'Confianza media', low: 'Confianza baja' } as Record<Confidence, string>,
  line: 'línea', snippet: 'Fragmento', hidden: 'Texto oculto decodificado', fix: 'Corrección', orientative: 'orientativo',
  exports: 'Exportar informe', blocked: 'Exportación bloqueada por el control de salida.',
  rulesTitle: 'Reglas AHS', mappingNote: 'Mapeos a OWASP Top 10 for LLM Applications 2025 e ISO/IEC 42001:2023 Anexo A orientativos: lectura propia de MCP-Shield, no un crosswalk oficial.',
  truncated: (n: number) => `${n} ${n === 1 ? 'línea supera' : 'líneas superan'} 4096 caracteres: las reglas de patrones leen solo el principio (los caracteres invisibles se buscan en toda la línea).`,
  risk: 'Riesgo del harness', staticNote: 'Análisis estático: no se ejecuta ningún script, no se resuelven URLs y no se instala ningún paquete.',
}
type T = typeof es
const en: T = {
  kicker: 'Agent file auditor', title: 'Harness-Shield',
  sub: 'Static analysis of SKILL.md, CLAUDE.md, AGENTS.md, .cursorrules, .mcp.json and Bash, Python or PowerShell hooks. Nothing runs: content is only read as text.',
  privacy: 'Files are read into your browser memory and are gone on reload or with “Clear”. Nothing is uploaded.',
  open: 'Open files', samples: 'Load samples', clear: 'Clear', samplesToast: (n: number) => `${n} sample files loaded (deliberately malicious)`,
  drop: 'Drop agent configuration files here', dropHint: 'Up to 50 text files of at most 5 MB. Binary files are rejected without being read.', dropActive: 'Drop to analyse',
  paste: 'Paste content', pasteName: 'File name', pasteBody: 'Content', add: 'Add', pasteEmpty: 'Paste the content first.',
  files: 'Files', remove: (n: string) => `Remove ${n}`, lines: (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`,
  kinds: { skill: 'Skill', claude: 'CLAUDE.md', agents: 'AGENTS.md', cursorrules: 'Rules', mcp: 'MCP', bash: 'Bash', python: 'Python', powershell: 'PowerShell', markdown: 'Markdown', json: 'JSON', config: 'Config', text: 'Text' },
  reject: { size: 'larger than 5 MB: not read', binary: 'looks binary: only text files are accepted', empty: 'is empty', 'too-many': 'the 50-file limit was reached', read: 'could not be read' },
  rejectedTitle: 'Rejected files',
  findings: 'Findings', all: 'All', none: 'No findings in the loaded files. This is a heuristic analysis: still review what you install.',
  emptyTitle: 'Load files or the samples', emptyBody: 'Try “Load samples”: seven malicious files with hidden Unicode, comments carrying instructions, exfiltrating hooks and an unpinned .mcp.json.',
  confidence: { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' },
  line: 'line', snippet: 'Snippet', hidden: 'Decoded hidden text', fix: 'Fix', orientative: 'orientative',
  exports: 'Export report', blocked: 'Export blocked by the output gate.',
  rulesTitle: 'AHS rules', mappingNote: 'Mappings to the OWASP Top 10 for LLM Applications 2025 and ISO/IEC 42001:2023 Annex A are orientative: MCP-Shield\'s own reading, not an official crosswalk.',
  truncated: (n: number) => `${n} ${n === 1 ? 'line exceeds' : 'lines exceed'} 4096 characters: pattern rules read only the start (invisible characters are searched across the whole line).`,
  risk: 'Harness risk', staticNote: 'Static analysis: no script runs, no URL is resolved and no package is installed.',
}
export const hsStrings = (l: Lang): T => (l === 'en' ? en : es)

/** Help-centre section (ES/EN). */
export const hsHelp = (l: Lang) => l === 'en' ? {
  title: 'Harness-Shield (agent files)',
  items: [
    'Drop or paste SKILL.md, CLAUDE.md, AGENTS.md, .cursorrules, .mcp.json and hook scripts (.sh, .py, .ps1). Size is checked before reading (5 MB per file, 50 files) and binary files are rejected.',
    'Rules AHS-01..08: invisible and bidirectional Unicode (with decoded Unicode Tags), instruction hijack and hidden comments, network exfiltration, unpinned MCP dependencies, sensitive files and credential dumps, curl | sh, obfuscated base64 execution and auto-approval.',
    'Hook scripts, JSON and code blocks keep the full severity; prose in instruction files is downgraded and carries lower confidence, to avoid false positives in documentation.',
    'Each finding shows file, line, a redacted snippet of at most 140 characters, the OWASP Top 10 for LLM 2025 category and an ISO/IEC 42001 Annex A control (orientative mapping). SARIF and Markdown exports pass the same output gate as the Auditor.',
  ],
} : {
  title: 'Harness-Shield (archivos de agente)',
  items: [
    'Suelta o pega SKILL.md, CLAUDE.md, AGENTS.md, .cursorrules, .mcp.json y scripts de hooks (.sh, .py, .ps1). El tamaño se comprueba antes de leer (5 MB por archivo, 50 archivos) y los binarios se rechazan.',
    'Reglas AHS-01..08: Unicode invisible y bidireccional (con Unicode Tags decodificados), secuestro de instrucciones y comentarios ocultos, exfiltración por red, dependencias MCP sin fijar, ficheros sensibles y volcado de credenciales, curl | sh, ejecución de base64 ofuscado y aprobación automática.',
    'Los hooks, el JSON y los bloques de código mantienen la severidad completa; la prosa de los archivos de instrucciones baja de severidad y lleva menos confianza, para evitar falsos positivos en documentación.',
    'Cada hallazgo muestra archivo, línea, un fragmento redactado de 140 caracteres como máximo, la categoría OWASP Top 10 for LLM 2025 y un control del Anexo A de ISO/IEC 42001 (mapeo orientativo). Las exportaciones SARIF y Markdown pasan el mismo control de salida que el Auditor.',
  ],
}
