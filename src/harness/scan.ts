import type { Severity } from '../types/mcp.types'
import type { Lang } from '../i18n/lang'
import { pick } from '../i18n/lang'
import type { Confidence, HarnessFile, HarnessFinding, HarnessKind, HarnessResult, HarnessRuleId } from './types'
import { hsRule } from './rules'
import { detectKind, isCodeKind, isScript, HS_MAX_LINE } from './intake'
import { findSmuggling } from '../engine/rules/smugglingRules'
import { parseMcp, stripJsonc } from '../engine/parse'
import { jsoncErrorAt } from './jsonc'
import { redactString, safeText } from '../engine/redact'
import { bandOf } from '../engine/grades'

/**
 * Harness-Shield scanner: static, line-oriented analysis of agent configuration files (SKILL.md, CLAUDE.md,
 * AGENTS.md, .cursorrules, .mcp.json, hook scripts). Nothing is executed, evaluated or fetched.
 * Every regex is linear: no nested quantifiers, bounded gaps, and pattern rules see at most HS_MAX_LINE
 * characters of a line.
 */

/* ── Text helpers ─────────────────────────────────────────────────────────────────────── */

/** Printable form: invisible, bidi, tag, variation-selector and control code points become ⟨U+XXXX⟩. */
export const reveal = (s: string) => safeText(s).replace(/[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, ch => `⟨U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}⟩`)
const clip = (s: string, n: number) => { const a = Array.from(s); return a.length > n ? a.slice(0, n - 1).join('') + '…' : s }
/** Evidence snippet: redacted, opaque blobs shortened, invisible code points revealed, max 140 characters. */
export function snippetOf(line: string): string {
  const head = Array.from(line.slice(0, 1200)).slice(0, 1000).join('')
  const s = reveal(redactString(head).replace(/[A-Za-z0-9+/_=-]{40,}/g, m => m.slice(0, 12) + '…')).trim()
  return clip(s, 140)
}
const printableRatio = (s: string) => (s.length ? (s.match(/[\x20-\x7e\t\n\r]/g)?.length ?? 0) / s.length : 0)

/* ── Context ──────────────────────────────────────────────────────────────────────────── */

type Level = 'script' | 'agentBlock' | 'docBlock' | 'instruction' | 'prose'
const AGENT_KINDS: HarnessKind[] = ['skill', 'claude', 'agents', 'cursorrules']
const SEV: Severity[] = ['low', 'medium', 'high', 'critical']
const CONF: Confidence[] = ['low', 'medium', 'high']
const down = <T>(scale: T[], v: T, n = 1): T => scale[Math.max(0, scale.indexOf(v) - n)]

/** Severity and confidence for a line context: machine-read files keep the base; prose is downgraded. */
function grade(base: Severity, conf: Confidence, lvl: Level): { severity: Severity; confidence: Confidence } {
  switch (lvl) {
    case 'script': return { severity: base, confidence: conf }
    case 'agentBlock': return { severity: base, confidence: down(CONF, conf) }
    case 'docBlock': case 'instruction': return { severity: down(SEV, base), confidence: down(CONF, conf) }
    default: return { severity: down(SEV, base, 2), confidence: 'low' }
  }
}

/** Per-line level: hook scripts and JSON/TOML are code; Markdown has fenced blocks, YAML frontmatter and prose. */
function levels(lines: string[], kind: HarnessKind): Level[] {
  if (isCodeKind(kind)) return lines.map(() => 'script')
  const agent = AGENT_KINDS.includes(kind)
  const out: Level[] = []
  let fence = '', front = lines[0]?.trim() === '---'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (front) { out.push('script'); if (i > 0 && /^(?:---|\.\.\.)\s*$/.test(l)) front = false; if (i > 400) front = false; continue }
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(l)
    if (fence) {
      out.push(agent ? 'agentBlock' : 'docBlock')
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && l.trim() === m[1]) fence = ''
      continue
    }
    if (m) { fence = m[1]; out.push(agent ? 'agentBlock' : 'docBlock'); continue }
    out.push(agent ? 'instruction' : 'prose')
  }
  return out
}
const isCode = (l: Level) => l === 'script' || l === 'agentBlock' || l === 'docBlock'

/* ── Patterns (all linear) ────────────────────────────────────────────────────────────── */

const NEG = /\b(?:never|do\s{1,3}not|don't|must\s{1,3}not|avoid|forbidden|nunca|jam[aá]s|no\s{1,3}(?:leas|accedas|toques|abras|uses|subas|env[ií]es|ejecutes|copies)|evita|prohibido)\b/i
const URL = /\b(?:https?|ftp|wss?):\/\/[^\s"'`<>]{1,300}/i
const NET_CLI = /\b(?:curl|wget|nc|ncat|netcat|socat|telnet|scp|sftp|rsync|ftp|Invoke-WebRequest|Invoke-RestMethod|iwr|irm|Start-BitsTransfer)\b/i
// [R] and [B] keep the literal browser API names out of the bundle: CI greps dist/ for them as its zero-egress check.
const NET_CALL = /\b(?:requests\.(?:get|post|put|patch|request)|httpx\.(?:get|post|put|request)|urllib3?\.request|urlopen|http\.client|aiohttp\.ClientSession|fetch|axios(?:\.(?:get|post|put))?|XMLHttp[R]equest|send[B]eacon|WebSocket|Net\.WebClient|UploadString|UploadFile|UploadData|TcpClient|socket\.(?:create_connection|connect))\s{0,3}\(/i
const NET_TARGET = /\b(?:https?|ftp|wss?):\/\/|\/dev\/(?:tcp|udp)\/|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\$\{?[A-Za-z_]\w{0,60}|\$env:\w/i
const SECRET_REF = /\$\{?[A-Za-z_]{0,40}(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIALS?|SESSION|COOKIE)|\$env:[A-Za-z_]{0,40}(?:TOKEN|SECRET|PASSWORD|KEY|CRED)|os\.environ|os\.getenv|process\.env|getenv\(|\bprintenv\b|\benv\s{0,3}\||Get-ChildItem\s{1,3}env:|\.ssh[/\\]|\bid_(?:rsa|dsa|ecdsa|ed25519)\b|\.aws[/\\]credentials|\/etc\/shadow|\.netrc\b|\.git-credentials|[\s"'/=@(]\.env\b(?!\.(?:example|sample|template|dist))/i
const UPLOAD = /(?:^|\s)(?:-d|--data(?:-binary|-raw|-urlencode)?|-F|--form|-T|--upload-file|--post-data|--post-file|-Body|-InFile)(?=[\s=@]|$)|-X\s{0,3}(?:POST|PUT)\b|-Method\s{1,3}(?:Post|Put)\b|\.(?:post|put|patch)\s{0,3}\(|method:\s{0,3}["'](?:POST|PUT)["']|UploadString|UploadFile|UploadData|send[B]eacon|\|\s{0,3}(?:nc|ncat|netcat|socat)\b|\/dev\/tcp\//i

const SENS_FILE = /[/\\]\.ssh(?:[/\\]|\b)|\bid_(?:rsa|dsa|ecdsa|ed25519)\b|\.aws[/\\]credentials\b|\/etc\/(?:shadow|gshadow|sudoers)\b|\.(?:netrc|pgpass|git-credentials|pypirc)\b|\.docker[/\\]config\.json|\.kube[/\\]config\b|\.config[/\\]gh[/\\]hosts\.yml|\.gnupg\b|security\s{1,3}find-(?:generic|internet)-password|Login Data\b|~\/\.ssh\b/i
const DOTENV = /\b(?:cat|source|less|more|head|tail|bat|type|gc|Get-Content|open|readFile(?:Sync)?|read_text|load_dotenv|dotenv\.config)\b[^\n]{0,80}[\s"'(/=.]\.env\b(?!\.(?:example|sample|template|dist))|^\s{0,8}\.\s{1,3}\.?\/?\.env\b/i
const ENV_DUMP = /^\s{0,20}(?:printenv|env|set|export\s{1,3}-p|declare\s{1,3}-x)\s{0,5}(?:$|[|>;&])|\bprintenv\s{0,5}(?:$|[|>;&)])|\b(?:Get-ChildItem|gci|dir|ls)\s{1,5}env:(?:\s|$|[|)])|\[(?:System\.)?Environment\]::GetEnvironmentVariables\(\)|(?:json\.dumps|str|repr)\(\s{0,5}(?:dict\(\s{0,5})?os\.environ\b|(?:data|json|body|params)\s{0,3}=\s{0,3}(?:dict\(\s{0,3})?os\.environ\b|JSON\.stringify\(\s{0,5}process\.env\s{0,5}[,)]/i
const ENV_SINGLE = /process\.env\.[A-Z_]{0,40}(?:TOKEN|SECRET|PASSWORD|API_?KEY|PRIVATE_?KEY)\b|os\.environ(?:\.get\(|\[)\s{0,3}["'][A-Z_]{0,40}(?:TOKEN|SECRET|PASSWORD|API_?KEY|PRIVATE_?KEY)/

const DL = '(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)'
const PIPE_SHELL = new RegExp(`\\b${DL}\\b[^|\\n]{0,300}\\|\\s{0,3}(?:sudo\\s{1,3})?(?:(?:ba|z|da|k|fi)?sh|python[\\d.]{0,4}|node|perl|ruby|iex|Invoke-Expression|pwsh|powershell)\\b`, 'i')
const SUBST_SHELL = new RegExp(`\\b(?:(?:ba|z)?sh|source)\\s{1,3}(?:-c\\s{1,3})?["']?(?:<\\(|\\$\\()\\s{0,3}${DL}\\b|\\b(?:iex|Invoke-Expression)\\s{0,3}\\(?\\s{0,3}\\(?\\s{0,3}(?:${DL}|New-Object\\s{1,3}(?:System\\.)?Net\\.WebClient)|DownloadString\\([^)\\n]{0,300}\\)\\s{0,3}\\|\\s{0,3}(?:iex|Invoke-Expression)|\\beval\\s{1,3}"?\\$\\(\\s{0,3}${DL}\\b`, 'i')

const DECODE_EXEC = /base64\s{1,3}(?:-d|--decode|-D)\b[^\n]{0,200}\|\s{0,3}(?:sudo\s{1,3})?(?:(?:ba|z|da)?sh|python[\d.]{0,4}|perl)\b|\beval\s{0,3}["'(]?\s{0,3}"?\$\((?:[^)\n]{0,2000})base64\s{1,3}(?:-d|--decode|-D)|\bexec\s{0,3}\(\s{0,3}(?:base64\.b64decode|codecs\.decode|bytes\.fromhex|zlib\.decompress|marshal\.loads)|\beval\s{0,3}\(\s{0,3}(?:atob|Buffer\.from)\s{0,3}\(|\bnew\s{1,3}Function\s{0,3}\(\s{0,3}atob\(|FromBase64String[^\n]{0,300}\b(?:iex|Invoke-Expression)\b|\b(?:iex|Invoke-Expression)\b[^\n]{0,300}FromBase64String|\b(?:powershell|pwsh)(?:\.exe)?\b[^\n]{0,120}\s-(?:EncodedCommand|enc|ec|e)\s{1,3}[A-Za-z0-9+/=]{20,}/i
const BLOB = /[A-Za-z0-9+/]{160,}={0,2}/
const BLOB_BAD = /\b(?:curl|wget|bash|sh\s|nc\s|eval|exec|python|powershell|iex|ssh|token|secret|password|https?:\/\/|\/dev\/tcp|id_rsa|base64)\b/i

const AUTO_STRONG = /--dangerously-skip-permissions\b|\bbypassPermissions\b|--dangerously-bypass-approvals-and-sandbox\b|"?(?:autoApprove|alwaysAllow|auto_approve|autoApproveAll)"?\s{0,3}[:=]\s{0,3}(?:true\b|\[\s{0,3}"\*")|"chat\.tools\.autoApprove"\s{0,3}:\s{0,3}true|"?enableAllProjectMcpServers"?\s{0,3}[:=]\s{0,3}true|--yolo\b|"?yolo(?:Mode)?"?\s{0,3}[:=]\s{0,3}true|--trust-all-tools\b|--full-auto\b|approval_policy\s{0,3}=\s{0,3}"never"|--ask-for-approval\s{1,3}never|danger-full-access|"?trust"?\s{0,3}:\s{0,3}true/i
const AUTO_LIST = /"(?:autoApprove|alwaysAllow)"\s{0,3}:\s{0,3}\[\s{0,3}"[^"*\]]/

/** Instruction hijack phrases (EN + ES). Bounded gaps only. */
const HIJACK: { re: RegExp; strong: boolean }[] = [
  { strong: true, re: /\b(?:ignore|disregard|forget|skip|override)\s{1,5}(?:all\s{1,5}|any\s{1,5})?(?:of\s{1,5})?(?:the\s{1,5}|your\s{1,5}|my\s{1,5})?(?:previous|prior|above|earlier|preceding|former|system|original)\s{1,5}(?:instructions?|prompts?|rules|guidelines|directions|directives|context|messages?)\b/gi },
  { strong: true, re: /\b(?:override|bypass|disable|ignore)\s{1,5}(?:the\s{1,5}|your\s{1,5}|all\s{1,5})?(?:system\s{1,5}prompt|system\s{1,5}instructions?|safety\s{1,5}(?:rules|guidelines|checks|filters)|guardrails|permission\s{1,5}(?:checks|prompts))\b/gi },
  { strong: true, re: /\byou\s{1,5}are\s{1,5}now\s{1,5}(?:in\s{1,5})?(?:DAN|developer\s{1,5}mode|jailbroken|unrestricted|an?\s{1,5}unrestricted)\b/gi },
  { strong: true, re: /\b(?:do\s{1,5}not|don't|never)\s{1,5}(?:tell|inform|notify|alert|ask|mention\s{1,5}(?:this\s{1,5})?to|reveal\s{1,5}(?:this\s{1,5})?to|show\s{1,5}(?:this\s{1,5})?to)\s{1,5}(?:the\s{1,5})?user\b/gi },
  { strong: true, re: /\bwithout\s{1,5}(?:telling|informing|notifying|asking|alerting)\s{1,5}(?:the\s{1,5})?user\b/gi },
  { strong: true, re: /\b(?:ignora|ignorad|olvida|olvidad|olvide|descarta|omite|anula)\s{1,5}(?:todas?\s{1,5})?(?:las\s{1,5}|tus\s{1,5}|sus\s{1,5}|los\s{1,5})?(?:instrucciones|indicaciones|reglas|órdenes|ordenes|directrices|normas)\s{1,5}(?:anteriores|previas|de\s{1,5}arriba|del\s{1,5}sistema|originales)\b/gi },
  { strong: true, re: /\b(?:anula|sobrescribe|sobreescribe|ignora|desactiva|sáltate|saltate)\s{1,5}(?:el\s{1,5}|la\s{1,5}|las\s{1,5}|los\s{1,5}|tus\s{1,5})?(?:prompt|mensaje|instrucciones|reglas|indicaciones)\s{1,5}(?:de|del)\s{1,5}sistema\b/gi },
  { strong: true, re: /\bno\s{1,5}(?:se\s{1,5}lo\s{1,5}|le\s{1,5})?(?:digas|menciones|informes|cuentes|avises|muestres|preguntes)\s{1,5}(?:nada\s{1,5})?(?:de\s{1,5}esto\s{1,5}|esto\s{1,5})?al\s{1,5}usuario\b/gi },
  { strong: true, re: /\bsin\s{1,5}(?:avisar|informar|decir(?:le)?|preguntar|notificar|consultar)\s{1,5}(?:nada\s{1,5})?al\s{1,5}usuario\b/gi },
  { strong: true, re: /\b(?:ahora|a\s{1,5}partir\s{1,5}de\s{1,5}ahora)\s{1,5}eres\s{1,5}(?:un\s{1,5}|una\s{1,5})?(?:DAN|modo\s{1,5}desarrollador|asistente\s{1,5}sin\s{1,5}restricciones|IA\s{1,5}sin\s{1,5}restricciones)\b/gi },
  { strong: false, re: /<\/?(?:system|system-prompt|admin|instructions)>|\[\s{0,3}(?:SYSTEM|INST)\s{0,3}\]|\bnew\s{1,5}system\s{1,5}(?:prompt|instructions?)\s{0,3}:|\bnuevas?\s{1,5}instrucciones\s{1,5}del\s{1,5}sistema\s{0,3}:/gi },
]
const COMMENT_ACTION = /\b(?:curl|wget|ssh|scp|upload|exfiltrat\w{0,6}|send|post|execute|exec|eval|delete|token|secret|password|credentials?|api[_ ]?key|id_rsa|base64|ejecuta|envía|envia|sube|borra|lee|contraseña|secreto|credenciales)\b/i
const COMMENT_BENIGN = /^\s{0,5}(?:prettier-ignore(?:-start|-end)?|markdownlint-[\w-]{1,40}|toc|end\s?toc|vale\s|cspell:|eslint-|textlint-|omit\s+from\s+toc)/i

/* ── Scanner ─────────────────────────────────────────────────────────────────────────── */

interface Emit { ruleId: HarnessRuleId; severity: Severity; confidence: Confidence; line: number; raw: string; title: [string, string]; detail: [string, string]; fix: [string, string]; hidden?: string }

function scanFile(f: HarnessFile, idx: number, lang: Lang): { findings: HarnessFinding[]; kind: HarnessKind; lines: number; truncated: number } {
  const L = (x: [string, string]) => pick(lang, x[0], x[1])
  const text = f.text.charCodeAt(0) === 0xfeff ? f.text.slice(1) : f.text
  const kind = f.kind ?? detectKind(f.name, text)
  const lines = text.split('\n').map(l => (l.endsWith('\r') ? l.slice(0, -1) : l))
  const lv = levels(lines, kind)
  const out = new Map<string, Emit>()
  const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 }
  const emit = (e: Emit) => { const k = `${e.ruleId}:${e.line}`; const p = out.get(k); if (!p || RANK[e.severity] > RANK[p.severity]) out.set(k, e) }
  const cap = (l: string) => (l.length > HS_MAX_LINE ? l.slice(0, HS_MAX_LINE) : l)
  let truncated = 0
  const script = isScript(kind)

  // File-level context for hooks: does the file read secrets anywhere / talk to the network anywhere?
  let fileSecret = false, fileNet = false
  lines.forEach((raw, i) => {
    if (!isCode(lv[i])) return
    const l = cap(raw)
    if (SENS_FILE.test(l) || ENV_DUMP.test(l) || DOTENV.test(l)) fileSecret = true
    if ((NET_CLI.test(l) && NET_TARGET.test(l)) || NET_CALL.test(l)) fileNet = true
  })

  lines.forEach((raw, i) => {
    const n = i + 1, lvl = lv[i]
    if (raw.length > HS_MAX_LINE) truncated++
    const l = cap(raw)
    const code = isCode(lvl)
    const negated = !code && NEG.test(l)

    // AHS-01 · invisible / bidi Unicode (full line, single character class: linear)
    unicodeRule(raw, n, lvl, script, emit)

    // AHS-03 · network exfiltration
    const cli = NET_CLI.test(l) && NET_TARGET.test(l), call = code && NET_CALL.test(l)
    const dlExec = PIPE_SHELL.test(l) || SUBST_SHELL.test(l)
    if ((cli || call) && !(code === false && !URL.test(l))) {
      const secret = SECRET_REF.test(l), upload = UPLOAD.test(l)
      let base: Severity | undefined, conf: Confidence = 'high'
      if (code) {
        if (secret) base = 'critical'
        else if (upload && fileSecret) base = 'high'
        else if (upload) { base = 'medium'; conf = 'medium' }
        else if (fileSecret && !dlExec) { base = 'medium'; conf = 'medium' }
        else if (!dlExec) { base = 'low'; conf = 'low' }
      } else if (!negated) {
        if (secret) base = 'critical'
        else if (upload) { base = 'high'; conf = 'medium' }
      }
      if (base) {
        const g = grade(base, conf, lvl)
        emit({ ruleId: 'AHS-03', ...g, line: n, raw,
          title: secret ? ['Envío por red de secretos o variables de entorno', 'Network send of secrets or environment variables'] : upload ? ['Subida de datos a un host externo', 'Data upload to an external host'] : ['Conexión de red desde un hook o script', 'Network connection from a hook or script'],
          detail: [`La línea combina una herramienta de red (curl, wget, nc, Invoke-WebRequest, requests…)${secret ? ' con variables de entorno, tokens o ficheros de credenciales' : upload ? ' con un envío de datos (-d, -F, POST, | nc)' : ''}. ${script ? 'Los hooks se ejecutan con los permisos del usuario sin que el agente lo pida.' : 'El agente puede ejecutarlo al seguir estas instrucciones.'}${fileSecret && !secret ? ' El mismo archivo lee secretos en otra línea.' : ''}`,
            `The line combines a network tool (curl, wget, nc, Invoke-WebRequest, requests…)${secret ? ' with environment variables, tokens or credential files' : upload ? ' with a data upload (-d, -F, POST, | nc)' : ''}. ${script ? 'Hooks run with the user\'s permissions without the agent asking.' : 'The agent may run it while following these instructions.'}${fileSecret && !secret ? ' The same file reads secrets on another line.' : ''}`],
          fix: ['Elimina la llamada o limítala a un destino propio y documentado; nunca envíes variables de entorno ni ficheros de credenciales. Revisa el hook antes de instalarlo y ejecútalo con red restringida.', 'Remove the call or limit it to a documented destination you own; never send environment variables or credential files. Review the hook before installing it and run it with restricted egress.'] })
      }
    }

    // AHS-05 · sensitive host files / credential dumps
    if (!negated) {
      const sens = SENS_FILE.test(l), dump = ENV_DUMP.test(l), dotenv = DOTENV.test(l), single = code && ENV_SINGLE.test(l)
      const netHere = (NET_CLI.test(l) && NET_TARGET.test(l)) || NET_CALL.test(l) || UPLOAD.test(l)
      let base: Severity | undefined, conf: Confidence = 'high'
      if (sens || dump) base = netHere || (code && fileNet) ? 'critical' : 'high'
      else if (dotenv) { base = netHere || (code && fileNet) ? 'high' : 'medium'; conf = 'medium' }
      else if (single) { base = 'low'; conf = 'low' }
      if (base && !code) { base = down(SEV, base); conf = 'medium' }
      if (base) {
        const g = single ? { severity: 'low' as Severity, confidence: 'low' as Confidence } : grade(base, conf, lvl)
        emit({ ruleId: 'AHS-05', ...g, line: n, raw,
          title: dump ? ['Volcado de todas las variables de entorno', 'Dump of every environment variable'] : sens ? ['Acceso a claves SSH, credenciales cloud o ficheros del sistema', 'Access to SSH keys, cloud credentials or system files'] : dotenv ? ['Lectura de un fichero .env', 'Read of a .env file'] : ['Lectura de una variable de entorno con nombre de secreto', 'Read of a secret-named environment variable'],
          detail: [`${dump ? 'printenv, env o equivalentes exponen todos los tokens de la sesión.' : sens ? 'Rutas como ~/.ssh, id_rsa, ~/.aws/credentials o /etc/shadow contienen credenciales del equipo.' : dotenv ? 'Los .env suelen guardar claves de API.' : 'Confianza baja: leer una variable concreta es habitual; revísalo solo si el valor sale del equipo.'}${netHere || (code && fileNet) ? ' El archivo también hace llamadas de red: patrón típico de exfiltración.' : ''}`,
            `${dump ? 'printenv, env and equivalents expose every session token.' : sens ? 'Paths such as ~/.ssh, id_rsa, ~/.aws/credentials or /etc/shadow hold the machine\'s credentials.' : dotenv ? '.env files usually hold API keys.' : 'Low confidence: reading one variable is common; review it only if the value leaves the machine.'}${netHere || (code && fileNet) ? ' The file also makes network calls: a typical exfiltration pattern.' : ''}`],
          fix: ['Un hook, skill o regla no necesita leer claves del equipo: elimina el acceso o limítalo a una variable concreta, y deniega estas rutas en los permisos del agente (p. ej. deny Read(~/.ssh/**)).', 'A hook, skill or rule does not need the machine\'s keys: remove the access or limit it to one specific variable, and deny these paths in the agent permissions (e.g. deny Read(~/.ssh/**)).'] })
      }
    }

    // AHS-06 · remote download piped to an interpreter
    if (!negated && dlExec) {
      const g = grade('critical', 'high', lvl)
      emit({ ruleId: 'AHS-06', ...g, line: n, raw,
        title: ['Descarga remota ejecutada sin verificar (curl | sh, iex)', 'Remote download executed unverified (curl | sh, iex)'],
        detail: ['El contenido descargado se pasa directamente a un intérprete: quien controle el servidor o la red decide qué se ejecuta, sin hash ni firma.', 'Downloaded content is piped straight into an interpreter: whoever controls the server or the network decides what runs, with no hash or signature.'],
        fix: ['Descarga a un fichero, verifica su SHA-256 o firma y fija la versión; mejor, instala desde un gestor de paquetes con versión exacta.', 'Download to a file, verify its SHA-256 or signature and pin the version; better, install from a package manager with an exact version.'] })
    }

    // AHS-07 · obfuscated payload decoded and executed; opaque base64 blobs
    if (!negated && DECODE_EXEC.test(l)) {
      const g = grade('critical', 'high', lvl)
      emit({ ruleId: 'AHS-07', ...g, line: n, raw, hidden: decodedBlob(l),
        title: ['Payload ofuscado que se decodifica y ejecuta', 'Obfuscated payload decoded and executed'],
        detail: ['base64 -d | sh, eval(atob(…)), exec(base64.b64decode(…)) o -EncodedCommand ocultan al revisor lo que se ejecuta.', 'base64 -d | sh, eval(atob(…)), exec(base64.b64decode(…)) or -EncodedCommand hide what runs from the reviewer.'],
        fix: ['Sustituye el payload por el código en claro y revísalo; rechaza hooks y skills que decodifican y ejecutan contenido.', 'Replace the payload with plain code and review it; reject hooks and skills that decode and execute content.'] })
    } else {
      const m = BLOB.exec(l)
      if (m) {
        const dec = decodedBlob(m[0])
        const bad = !!dec && BLOB_BAD.test(dec)
        if (bad || code) {
          const g = bad ? grade('high', 'medium', lvl) : { severity: 'low' as Severity, confidence: 'low' as Confidence }
          emit({ ruleId: 'AHS-07', ...g, line: n, raw, hidden: dec,
            title: bad ? ['Bloque base64 con comandos ocultos', 'Base64 blob hiding commands'] : ['Bloque base64 opaco', 'Opaque base64 blob'],
            detail: bad ? ['El bloque decodificado contiene comandos, URLs o nombres de secretos.', 'The decoded blob contains commands, URLs or secret names.'] : ['Confianza baja: un bloque largo codificado impide revisar el contenido.', 'Low confidence: a long encoded blob prevents reviewing the content.'],
            fix: ['Guarda el contenido en claro o justifica el bloque (p. ej. una imagen) y su hash.', 'Keep the content in plain text or justify the blob (e.g. an image) and its hash.'] })
        }
      }
    }

    // AHS-08 · auto-approval / permission bypass
    const strong = AUTO_STRONG.test(l), list = !strong && AUTO_LIST.test(l)
    const allowed = lvl === 'script' && !isCodeKind(kind) && /^\s{0,4}allowed-tools\s{0,3}:/i.test(l) ? allowedToolsRisk(l, lines, i) : false
    if (!negated && (strong || list || allowed)) {
      const g = grade(strong || allowed ? 'high' : 'medium', strong || allowed ? 'high' : 'medium', lvl)
      emit({ ruleId: 'AHS-08', ...g, line: n, raw,
        title: allowed ? ['allowed-tools concede Bash sin restricciones', 'allowed-tools grants unrestricted Bash'] : strong ? ['Aprobación automática o permisos desactivados', 'Auto-approval or permissions disabled'] : ['Herramientas MCP aprobadas de antemano', 'MCP tools pre-approved'],
        detail: ['El agente ejecutaría herramientas o comandos sin pedir confirmación (bypassPermissions, --dangerously-skip-permissions, autoApprove, --yolo, Bash(*)…). Un contenido envenenado pasaría directamente a la acción.', 'The agent would run tools or commands without asking (bypassPermissions, --dangerously-skip-permissions, autoApprove, --yolo, Bash(*)…). Poisoned content would go straight to action.'],
        fix: ['Mantén la confirmación humana: limita allowed-tools a comandos concretos (p. ej. Bash(git status:*)) y quita autoApprove y los modos sin permisos fuera de un sandbox desechable.', 'Keep human confirmation: limit allowed-tools to specific commands (e.g. Bash(git status:*)) and drop autoApprove and permission-less modes outside a disposable sandbox.'] })
    }
  })

  // AHS-02 · instruction hijack and hidden comments (full text, multi-line)
  hijackRule(text, kind, lv, emit)
  // AHS-04 · unpinned MCP dependencies
  if (kind === 'mcp') mcpRule(text, lang, emit)

  const findings = [...out.values()].map((e, j): HarnessFinding => {
    const r = hsRule(e.ruleId)
    return { id: `${e.ruleId}:${idx}:${e.line}:${j}`, ruleId: e.ruleId, severity: e.severity, confidence: e.confidence, file: f.name, kind, line: e.line,
      snippet: snippetOf(e.raw), title: L(e.title), detail: L(e.detail), remediation: L(e.fix), hidden: e.hidden ? clip(reveal(redactString(e.hidden)), 200) : undefined,
      owasp: r.owasp, iso: r.iso, cwe: r.cwe }
  })
  return { findings, kind, lines: lines.length, truncated }
}

function decodedBlob(s: string): string | undefined {
  let tries = 0
  for (const m of s.matchAll(/[A-Za-z0-9+/]{16,}={0,2}/g)) {
    if (++tries > 20) break
    const b = m[0].replace(/=+$/, '').slice(0, 8000), r = b.length % 4
    const usable = r === 1 ? b.slice(0, -1) : b + '='.repeat((4 - r) % 4)
    try {
      const bin = atob(usable)
      const txt = new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
      if (txt.trim().length >= 4 && printableRatio(txt) > 0.9) return txt.slice(0, 400)
    } catch { /* not base64 */ }
  }
  return undefined
}

/** SKILL.md frontmatter: allowed-tools with Bash, Bash(*), or * (inline or YAML list on the following lines). */
function allowedToolsRisk(line: string, lines: string[], i: number): boolean {
  const vals = [line.slice(line.indexOf(':') + 1)]
  for (let j = i + 1; j < Math.min(lines.length, i + 60); j++) { const m = /^\s{1,8}-\s{1,3}(.{0,200})$/.exec(lines[j]); if (!m) break; vals.push(m[1]) }
  const toks = vals.join(',').replace(/[[\]"']/g, '').split(/,|\s(?![^(]{0,80}\))/).map(t => t.trim()).filter(Boolean)
  return toks.some(t => t === '*' || /^Bash$/i.test(t) || /^Bash\(\s{0,3}\*?\s{0,3}(?::\s{0,3}\*)?\s{0,3}\)$/i.test(t))
}

function unicodeRule(line: string, n: number, lvl: Level, script: boolean, emit: (e: Emit) => void) {
  // Fast path: nothing invisible, no ANSI, no variation selectors.
  // eslint-disable-next-line no-control-regex
  if (!/[\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u{E0000}-\u{E007F}\x1b\u009b]|\u200D|\p{Variation_Selector}/u.test(line)) return
  const cps = Array.from(line, c => c.codePointAt(0)!)
  let bidi = 0, zw = 0, marks = 0
  const emoji = (c?: number) => c !== undefined && (c >= 0x1f000 || (c >= 0x2600 && c <= 0x27bf) || c === 0xfe0f)
  cps.forEach((c, k) => {
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) bidi++
    else if (c === 0x200e || c === 0x200f) marks++
    else if (c === 0x200d && emoji(cps[k - 1]) && emoji(cps[k + 1])) return // emoji ZWJ sequence
    else if ((c >= 0x200b && c <= 0x200d) || (c >= 0x2060 && c <= 0x2064) || c === 0xfeff) zw++
  })
  const sm = findSmuggling(line)
  const hidden = sm.map(h => h.hidden?.trim()).filter((x): x is string => !!x && x.length > 0).join(' · ')
  const tags = sm.find(h => h.kind === 'tags'), other = sm.filter(h => h.kind !== 'tags')
  if (!bidi && !zw && !marks && !sm.length) return
  let base: Severity = 'low', conf: Confidence = 'medium'
  if (hidden.length >= 3) { base = 'critical'; conf = 'high' }
  else if (bidi) { base = script || lvl === 'script' ? 'critical' : 'high'; conf = 'high' }
  else if (tags || other.some(h => h.kind === 'sneaky' || h.kind === 'variation')) { base = 'high'; conf = 'high' }
  else if (other.some(h => h.kind === 'ansi') || zw + marks >= 2) base = 'medium'
  // Invisible characters are never "prose": they are not meant to be read by people.
  const g = { severity: base, confidence: conf }
  const parts = [bidi && `bidi ×${bidi} (U+202A–202E, U+2066–2069)`, zw && `zero-width ×${zw} (U+200B–200D, U+2060–2064, U+FEFF)`, marks && `LRM/RLM ×${marks}`, ...sm.map(h => `${h.kind} ×${h.count}`)].filter(Boolean).join(', ')
  emit({ ruleId: 'AHS-01', ...g, line: n, raw: line, hidden: hidden || undefined,
    title: hidden ? [`Texto oculto con Unicode invisible: "${clip(hidden, 60)}"`, `Hidden text in invisible Unicode: "${clip(hidden, 60)}"`] : bidi ? ['Caracteres de control bidireccional (Trojan Source)', 'Bidirectional control characters (Trojan Source)'] : ['Caracteres invisibles de ancho cero', 'Invisible zero-width characters'],
    detail: [`Detectado: ${parts}. El modelo lee estos caracteres aunque no se vean; los de control bidireccional reordenan lo que ve el revisor (CVE-2021-42574).`, `Detected: ${parts}. The model reads these characters even though they are not displayed; bidirectional controls reorder what the reviewer sees (CVE-2021-42574).`],
    fix: ['Elimina los caracteres (p. ej. con un normalizador que rechace U+200B–200F, U+202A–202E, U+2060–2064, U+2066–2069, U+FEFF y U+E0000–E007F) y revisa el texto visible resultante.', 'Remove the characters (e.g. with a normaliser rejecting U+200B–200F, U+202A–202E, U+2060–2064, U+2066–2069, U+FEFF and U+E0000–E007F) and review the resulting visible text.'] })
}

function lineIndex(text: string) {
  const starts = [0]
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1)
  return (pos: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1 } return lo + 1 }
}

function hijackRule(original: string, kind: HarnessKind, lv: Level[], emit: (e: Emit) => void) {
  // Invisible characters inside a phrase ("Ignore\u200B previous…") must not break detection: drop them first.
  // Newlines are untouched, so line numbers stay those of the original file.
  const text = original.replace(/[\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u00AD\u{E0000}-\u{E007F}]|\u200D/gu, '')
  const lineOf = lineIndex(text)
  const lines = original.split('\n')
  // Hidden comments: HTML <!-- … --> (linear indexOf scan; an unterminated one runs to the end) and [//]: # (…)
  const comments: { start: number; end: number; body: string; bodyAt: number }[] = []
  if (!isScript(kind) && kind !== 'mcp' && kind !== 'json') {
    for (let s = text.indexOf('<!--'); s >= 0 && comments.length < 2000;) {
      const e = text.indexOf('-->', s + 4), end = e < 0 ? text.length : e + 3
      comments.push({ start: s, end, body: text.slice(s + 4, e < 0 ? text.length : e).slice(0, 20_000), bodyAt: s + 4 })
      s = e < 0 ? -1 : text.indexOf('<!--', end)
    }
    let pos = 0
    for (const l of lines) {
      const m = /^\s{0,3}\[(?:\/\/|comment|_)\]:\s{0,5}(?:#|<>)\s{0,5}["'(]/.exec(l)
      if (m) comments.push({ start: pos, end: pos + l.length, body: l.slice(m[0].length), bodyAt: pos + m[0].length })
      pos += l.length + 1
    }
  }
  const inComment = (i: number) => comments.find(c => i >= c.start && i < c.end)
  const flagged = new Set<number>()
  for (const { re, strong } of HIJACK) {
    re.lastIndex = 0
    let count = 0
    for (let m = re.exec(text); m && count < 200; m = re.exec(text), count++) {
      const n = lineOf(m.index), c = inComment(m.index), lvl = lv[n - 1] ?? 'prose'
      if (c) flagged.add(c.start)
      let base: Severity, conf: Confidence
      if (c) { base = 'critical'; conf = 'high' }
      else if (!strong) { base = 'medium'; conf = 'low' }
      else if (lvl === 'docBlock' || lvl === 'prose') { base = 'medium'; conf = 'low' }
      else { base = 'high'; conf = 'medium' }
      emit({ ruleId: 'AHS-02', severity: base, confidence: conf, line: n, raw: lines[n - 1] ?? '',
        title: c ? ['Instrucción de secuestro oculta en un comentario', 'Hijack instruction hidden in a comment'] : ['Frase de secuestro de instrucciones', 'Instruction-hijack phrase'],
        detail: [`«${clip(m[0].replace(/\s+/g, ' '), 80)}»${c ? ': el comentario no se ve al renderizar el Markdown, pero el modelo lo lee.' : ': intenta anular las instrucciones del sistema o actuar a espaldas del usuario.'}`, `“${clip(m[0].replace(/\s+/g, ' '), 80)}”${c ? ': the comment is invisible in rendered Markdown, but the model reads it.' : ': it tries to override the system instructions or act behind the user\'s back.'}`],
        fix: ['Elimina el texto; un archivo de instrucciones legítimo no pide ignorar al sistema ni ocultar acciones al usuario. Revisa el historial de quién lo añadió.', 'Remove the text; a legitimate instruction file never asks to ignore the system or hide actions from the user. Check the history of who added it.'] })
    }
  }
  for (const c of comments) {
    if (flagged.has(c.start) || COMMENT_BENIGN.test(c.body)) continue
    const m = COMMENT_ACTION.exec(c.body)
    if (!m) continue
    const n = lineOf(c.bodyAt + m.index)
    emit({ ruleId: 'AHS-02', severity: 'high', confidence: 'medium', line: n, raw: lines[n - 1] ?? '',
      title: ['Comentario oculto con acciones o datos sensibles', 'Hidden comment with actions or sensitive data'],
      detail: [`Comentario invisible al renderizar que menciona «${m[0]}». Es un canal clásico para instrucciones que el usuario nunca ve.`, `Comment invisible when rendered that mentions “${m[0]}”. It is a classic channel for instructions the user never sees.`],
      fix: ['Quita el comentario o pásalo a texto visible y revísalo.', 'Remove the comment or make it visible text and review it.'] })
  }
}

/* ── AHS-04 · .mcp.json dependencies (parsed, not regex) ─────────────────────────────── */

const EXACT_SEMVER = /^v?\d{1,9}\.\d{1,9}\.\d{1,9}(?:-[0-9A-Za-z.-]{1,64})?(?:\+[0-9A-Za-z.-]{1,64})?$/
const EXACT_PEP440 = /^\d{1,9}(?:\.\d{1,9})?(?:\.\d{1,9})?(?:\.\d{1,9})?(?:(?:a|b|rc)\d{1,9})?(?:\.post\d{1,9})?(?:\.dev\d{1,9})?$/
type Pin = { ok: true } | { ok: false; why: 'latest' | 'none' | 'range' | 'tag' | 'git' | 'url'; version?: string }

export function pinStatus(spec: string, eco: 'npm' | 'pypi'): Pin {
  const s = spec.trim()
  if (!s || /^(?:\.{0,2}[/\\]|~[/\\]|[A-Za-z]:[/\\]|file:|\$\{|\$[A-Z_])/.test(s)) return { ok: true } // local path or variable
  if (/^(?:git\+|git:\/\/|github:|gitlab:|bitbucket:)/i.test(s) || /^https?:\/\/(?:www\.)?(?:github|gitlab|bitbucket)\.(?:com|org)\//i.test(s) || /^https?:\/\/\S{1,300}\.git(?:[#@]|$)/i.test(s))
    return /[#@][0-9a-f]{7,40}$/i.test(s) ? { ok: true } : { ok: false, why: 'git' }
  if (/^https?:\/\//i.test(s)) return { ok: false, why: 'url' }
  if (eco === 'npm') {
    const at = s.lastIndexOf('@'), v = at > 0 ? s.slice(at + 1) : ''
    if (!v) return { ok: false, why: 'none' }
    if (/^latest$/i.test(v)) return { ok: false, why: 'latest', version: v }
    if (EXACT_SEMVER.test(v)) return { ok: true }
    return /^[A-Za-z][\w-]{0,40}$/.test(v) ? { ok: false, why: 'tag', version: v } : { ok: false, why: 'range', version: v }
  }
  const m = /^([A-Za-z0-9._-]{1,200})(?:\[[^\]]{0,200}\])?\s{0,3}(===|==|@|>=|<=|~=|!=|>|<)?\s{0,3}(\S{0,100})$/.exec(s)
  if (!m || !m[2]) return { ok: false, why: 'none' }
  if (/^latest$/i.test(m[3])) return { ok: false, why: 'latest', version: m[3] }
  if ((m[2] === '==' || m[2] === '===' || m[2] === '@') && EXACT_PEP440.test(m[3])) return { ok: true }
  return { ok: false, why: 'range', version: `${m[2]}${m[3]}` }
}

/** Runner, auto-install flag and package spec from a server's command + args (cmd /c, wsl, sh -c unwrapped). */
export function runnerSpec(command: string, args: string[]): { eco: 'npm' | 'pypi'; runner: string; yes: boolean; spec?: string } | undefined {
  const base = (x: string) => (x.replace(/\\/g, '/').split('/').pop() ?? '').toLowerCase().replace(/\.(?:cmd|exe|bat|ps1)$/, '')
  let t = [command, ...args].filter(x => typeof x === 'string')
  for (let guard = 0; guard < 4 && t.length; guard++) {
    const b = base(t[0])
    if (b === 'cmd' && /^\/[ck]$/i.test(t[1] ?? '')) t = t.slice(2)
    else if (b === 'wsl' || b === 'sudo' || b === 'env') t = t.slice(1)
    else if (/^(?:ba|z|da)?sh$/.test(b) && t[1] === '-c' && t[2]) t = t[2].trim().split(/\s+/).slice(0, 64)
    else break
  }
  const b0 = base(t[0] ?? '')
  let eco: 'npm' | 'pypi' | undefined, i = 1, yes = false
  if (b0 === 'npx' || b0 === 'bunx') eco = 'npm'
  else if ((b0 === 'pnpm' || b0 === 'yarn') && t[1] === 'dlx') { eco = 'npm'; i = 2 }
  else if ((b0 === 'npm' && (t[1] === 'exec' || t[1] === 'x')) || (b0 === 'bun' && t[1] === 'x')) { eco = 'npm'; i = 2 }
  else if (b0 === 'uvx') { eco = 'pypi'; yes = true }
  else if (b0 === 'uv' && t[1] === 'tool' && t[2] === 'run') { eco = 'pypi'; i = 3; yes = true }
  else if (b0 === 'pipx' && t[1] === 'run') { eco = 'pypi'; i = 2; yes = true }
  if (!eco) return undefined
  let spec: string | undefined
  for (; i < t.length; i++) {
    const a = t[i]
    if (a === '-y' || a === '--yes') { yes = true; continue }
    if (a === '--') { spec ??= t[i + 1]; break }
    const pk = /^(?:--package|--from|--spec|-p)(?:=(.+))?$/.exec(a)
    if (pk) { spec = pk[1] ?? t[++i]; continue }
    if (/^(?:--with|--python|--index-url|--extra-index-url|--index|--registry|--cache|--prefix|--userconfig|-c|--call|--shell)$/.test(a)) { i++; continue }
    if (a.startsWith('-')) continue
    spec ??= a; break
  }
  return { eco, runner: b0, yes, spec }
}

function mcpRule(text: string, lang: Lang, emit: (e: Emit) => void) {
  const lines = text.split('\n')
  const r = parseMcp(text, lang)
  if (!r.config) {
    const at = jsoncErrorAt(text)
    const ln = at >= 0 ? text.slice(0, at).split('\n').length : 1
    emit({ ruleId: 'AHS-04', severity: 'medium', confidence: 'high', line: Math.min(Math.max(ln, 1), lines.length), raw: lines[Math.max(ln, 1) - 1] ?? '',
      title: ['No se pudo analizar el .mcp.json', 'The .mcp.json could not be parsed'],
      detail: [`${r.error ?? 'JSON no válido.'} Sin un JSON válido no se pueden comprobar las dependencias de los servidores.`, `${r.error ?? 'Invalid JSON.'} Without valid JSON the server dependencies cannot be checked.`],
      fix: ['Corrige el JSON y vuelve a analizarlo; el cliente MCP tampoco lo cargará tal cual.', 'Fix the JSON and analyse it again; the MCP client will not load it as is either.'] })
    return
  }
  const lineAt = (pos: number) => (pos < 0 ? 0 : text.slice(0, pos).split('\n').length)
  // Auto-approval lists live next to command/args (Cline, Roo: autoApprove / alwaysAllow; Gemini: trust).
  let rawServers: Record<string, unknown> = {}
  try { const j = JSON.parse(stripJsonc(text.replace(/^\uFEFF/, ''))) as Record<string, unknown>; const s = (j.mcpServers ?? j.servers ?? (j.mcp as Record<string, unknown> | undefined)?.servers) as Record<string, unknown> | undefined; if (s && typeof s === 'object') rawServers = s } catch { /* parseMcp already succeeded on the same text */ }
  for (const [name, v] of Object.entries(rawServers)) {
    if (!v || typeof v !== 'object') continue
    for (const key of ['autoApprove', 'alwaysAllow', 'trust'] as const) {
      if (!Object.prototype.hasOwnProperty.call(v, key)) continue
      const val = (v as Record<string, unknown>)[key]
      const all = val === true || (Array.isArray(val) && val.some(x => x === '*'))
      const some = Array.isArray(val) && val.length > 0
      if (!all && !some) continue
      const n = lineAt(text.indexOf(`"${key}"`, Math.max(0, text.indexOf(JSON.stringify(name))))) || 1
      const shown = clip(reveal(name), 60)
      emit({ ruleId: 'AHS-08', severity: all ? 'high' : 'medium', confidence: 'high', line: n, raw: lines[n - 1] ?? '',
        title: all ? [`Servidor «${shown}»: ${key} aprueba todas las herramientas`, `Server “${shown}”: ${key} approves every tool`] : [`Servidor «${shown}»: herramientas aprobadas de antemano (${key})`, `Server “${shown}”: tools pre-approved (${key})`],
        detail: ['El cliente ejecutará esas herramientas sin pedir confirmación; una descripción envenenada o un resultado manipulado pasa directamente a la acción.', 'The client will run those tools without asking; a poisoned description or a tampered result goes straight to action.'],
        fix: ['Quita la aprobación automática o limítala a herramientas de solo lectura revisadas.', 'Remove auto-approval or limit it to reviewed read-only tools.'] })
    }
  }
  for (const [name, srv] of Object.entries(r.config.mcpServers)) {
    const rs = runnerSpec(srv.command ?? '', srv.args ?? [])
    if (!rs) continue
    const keyPos = text.indexOf(JSON.stringify(name))
    const specPos = rs.spec ? text.indexOf(JSON.stringify(rs.spec).slice(1, -1), Math.max(0, keyPos)) : -1
    const n = lineAt(specPos >= 0 ? specPos : keyPos) || 1
    const shown = clip(reveal(name), 60), spec = rs.spec ? clip(reveal(rs.spec), 80) : '?'
    if (!rs.spec) {
      emit({ ruleId: 'AHS-04', severity: 'medium', confidence: 'medium', line: n, raw: lines[n - 1] ?? '',
        title: [`Servidor «${shown}»: no se identifica el paquete de ${rs.runner}`, `Server “${shown}”: the ${rs.runner} package cannot be identified`],
        detail: ['El comando usa un ejecutor que descarga paquetes, pero no se reconoce cuál.', 'The command uses a runner that downloads packages, but the package is not recognised.'],
        fix: ['Indica el paquete explícitamente con versión exacta.', 'Name the package explicitly with an exact version.'] })
      continue
    }
    const p = pinStatus(rs.spec, rs.eco)
    if (p.ok) continue
    const sev: Severity = p.why === 'git' ? 'high' : p.why === 'url' ? 'medium' : p.why === 'latest' || p.why === 'none' ? (rs.yes ? 'critical' : 'high') : rs.yes ? 'high' : 'medium'
    const what: Record<typeof p.why, [string, string]> = {
      latest: ['fijado a @latest', 'pinned to @latest'], none: ['sin versión', 'without a version'], range: [`con rango ${p.version}`, `with range ${p.version}`],
      tag: [`con etiqueta ${p.version}`, `with tag ${p.version}`], git: ['desde git sin commit fijo', 'from git without a pinned commit'], url: ['desde una URL sin hash', 'from a URL without a hash'],
    }
    emit({ ruleId: 'AHS-04', severity: sev, confidence: 'high', line: n, raw: lines[n - 1] ?? '',
      title: [`Servidor «${shown}»: ${spec} ${what[p.why][0]}${rs.yes ? ' y auto-instalación' : ''}`, `Server “${shown}”: ${spec} ${what[p.why][1]}${rs.yes ? ' and auto-install' : ''}`],
      detail: [`${rs.runner}${rs.yes ? (rs.eco === 'npm' ? ' -y' : ' (instala sin preguntar)') : ''} descarga y ejecuta en cada arranque lo que el registro sirva en ese momento: un mantenedor comprometido o un typosquat llega directo al agente.`, `${rs.runner}${rs.yes ? (rs.eco === 'npm' ? ' -y' : ' (installs without asking)') : ''} downloads and runs whatever the registry serves at start-up: a compromised maintainer or a typosquat reaches the agent directly.`],
      fix: [rs.eco === 'npm' ? 'Fija una versión exacta auditada (paquete@1.2.3) y, si es posible, usa un lockfile o una imagen con digest.' : 'Fija una versión exacta auditada (paquete==1.2.3) o un commit concreto para git (…@<sha>).', rs.eco === 'npm' ? 'Pin an exact audited version (package@1.2.3) and, where possible, use a lockfile or an image by digest.' : 'Pin an exact audited version (package==1.2.3) or a specific commit for git (…@<sha>).'] })
  }
}

/* ── Public API ───────────────────────────────────────────────────────────────────────── */

const WEIGHT: Record<Severity, number> = { critical: 25, high: 12, medium: 6, low: 2 }
const CONF_W: Record<Confidence, number> = { high: 1, medium: 0.75, low: 0.4 }
const ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function scanHarness(files: HarnessFile[], lang: Lang = 'es'): HarnessResult {
  const res = files.map((f, i) => ({ f, r: scanFile(f, i, lang), i }))
  const findings = res.flatMap(x => x.r.findings).sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || files.findIndex(f => f.name === a.file) - files.findIndex(f => f.name === b.file) || a.line - b.line)
  const counts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>
  findings.forEach(f => counts[f.severity]++)
  const raw = findings.reduce((s, f) => s + WEIGHT[f.severity] * CONF_W[f.confidence], 0)
  const riskScore = Math.min(100, Math.round(100 * (1 - Math.exp(-raw / 60))))
  return { findings, counts, riskScore, grade: files.length ? bandOf(riskScore).g : 'N/A',
    files: res.map(x => ({ name: x.f.name, kind: x.r.kind, lines: x.r.lines, findings: x.r.findings.length, truncatedLines: x.r.truncated })) }
}
