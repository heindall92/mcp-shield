import type { Rule, Finding, Severity } from '../../types/mcp.types'
import { pick } from '../../i18n/lang'
import { mk } from './util'

/**
 * ASCII smuggling detection, after the techniques catalogued by NVIDIA garak
 * (Apache-2.0, probes/smuggling + docs/source/ascii_smuggling.rst) and the
 * Embrace The Red research it cites. Pure detection: nothing is executed.
 */
const MAX = 20_000
const cps = (s: string) => Array.from(s.slice(0, MAX), c => c.codePointAt(0)!)
const isTag = (c: number) => c >= 0xe0000 && c <= 0xe007f
const isVs = (c: number) => (c >= 0xfe00 && c <= 0xfe0f) || (c >= 0xe0100 && c <= 0xe01ef)
const printable = (s: string) => s.length > 0 && /^[\x20-\x7e\t\n\r]+$/.test(s)

export interface Smuggling { kind: 'tags' | 'variation' | 'sneaky' | 'ansi'; count: number; hidden?: string }

/** Legit emoji tag sequence: U+1F3F4 + 2..6 tag letters/digits + CANCEL TAG (e.g. the flag of England). */
function stripFlagTags(c: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < c.length; i++) {
    if (c[i] === 0x1f3f4) {
      let j = i + 1
      while (j < c.length && ((c[j] >= 0xe0061 && c[j] <= 0xe007a) || (c[j] >= 0xe0030 && c[j] <= 0xe0039)) && j - i <= 6) j++
      if (j - i - 1 >= 2 && c[j] === 0xe007f) { out.push(0x1f3f4); i = j; continue }
    }
    out.push(c[i])
  }
  return out
}

export function findSmuggling(text: string): Smuggling[] {
  if (!text) return []
  const out: Smuggling[] = []
  const c = stripFlagTags(cps(text))
  // 1. Unicode tag characters: each maps to ASCII cp - 0xE0000
  const tags = c.filter(isTag)
  if (tags.length) out.push({ kind: 'tags', count: tags.length, hidden: tags.filter(t => t !== 0xe007f).map(t => String.fromCharCode(t - 0xe0000)).join('') })
  // 2. Variation selectors: a single VS15/VS16 after a base glyph is normal emoji presentation (e.g. U+26A0 U+FE0F).
  let suspicious = 0
  const vs: number[] = []
  for (let i = 0; i < c.length; i++) {
    if (!isVs(c[i])) continue
    vs.push(c[i])
    const run = isVs(c[i - 1] ?? 0) || isVs(c[i + 1] ?? 0)
    const normal = (c[i] === 0xfe0e || c[i] === 0xfe0f) && !run && i > 0
    if (!normal) suspicious++
  }
  if (suspicious) {
    // garak: chr(0xE0100 + ord(ch)); Paul Butler's byte scheme: FE00+b (b<16), E0100+(b-16)
    const garak = vs.filter(v => v >= 0xe0100).map(v => String.fromCharCode(v - 0xe0100)).join('')
    const butler = vs.map(v => String.fromCharCode(v >= 0xe0100 ? v - 0xe0100 + 16 : v - 0xfe00)).join('')
    out.push({ kind: 'variation', count: suspicious, hidden: printable(garak) ? garak : printable(butler) ? butler : undefined })
  }
  // 3. Sneaky Bits: U+2062 (0) / U+2064 (1), U+200B as space
  const bits = c.filter(x => x === 0x2062 || x === 0x2064 || x === 0x200b)
  if (bits.filter(x => x !== 0x200b).length >= 7) {
    const words = String.fromCodePoint(...bits).split('\u200b')
    const decoded = words.map(w => { let s = ''; let acc = ''
      for (const ch of w) { acc += ch === '\u2062' ? '0' : '1'; if (acc.length === 7) { s += String.fromCharCode(parseInt(acc, 2)); acc = '' } }
      return s }).join(' ')
    out.push({ kind: 'sneaky', count: bits.length, hidden: printable(decoded) ? decoded : undefined })
  }
  // 4. ANSI escape sequences (ESC [ … / OSC / 8-bit CSI): can rewrite what a terminal client shows
  // eslint-disable-next-line no-control-regex
  const ansi = text.slice(0, MAX).match(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[@-Z\\-_]|\u009b[0-?]*[ -/]*[@-~]/g)
  if (ansi?.length) out.push({ kind: 'ansi', count: ansi.length })
  return out
}

/** Printable view of a string: invisible code points become ⟨U+XXXX⟩ so evidence never hides anything. */
export const visible = (s: string, max = 140) => Array.from(s).map(ch => {
  const cp = ch.codePointAt(0)!
  return isTag(cp) || isVs(cp) || cp === 0x1b || cp === 0x9b || (cp >= 0x2060 && cp <= 0x2064) || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff ? `⟨U+${cp.toString(16).toUpperCase().padStart(4, '0')}⟩` : ch
}).join('').slice(0, max)

const KIND = {
  tags: ['caracteres Unicode Tag (U+E0000–E007F)', 'Unicode Tag characters (U+E0000–E007F)'],
  variation: ['selectores de variación (U+FE00–FE0F, U+E0100–E01EF)', 'variation selectors (U+FE00–FE0F, U+E0100–E01EF)'],
  sneaky: ['Sneaky Bits (U+2062/U+2064)', 'Sneaky Bits (U+2062/U+2064)'],
  ansi: ['secuencias de escape ANSI', 'ANSI escape sequences'],
} as const

export const asciiSmuggling: Rule = {
  id: 'MCPS-TP-003', category: 'tool-poisoning', name: { es: 'ASCII smuggling / Unicode invisible', en: 'ASCII smuggling / invisible Unicode' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    const fields: [string, string][] = [
      ...(server.args ?? []).map((a, i) => [`args[${i}]`, a] as [string, string]),
      ...(server.tools ?? []).flatMap((t, i) => [[`tools[${i}].name`, t.name ?? ''], [`tools[${i}].description`, t.description ?? ''], [`tools[${i}].inputSchema`, t.inputSchema ? JSON.stringify(t.inputSchema) : '']] as [string, string][]),
    ]
    for (const [where, value] of fields) {
      const hits = findSmuggling(value)
      if (!hits.length) continue
      const hidden = hits.map(h => h.hidden).filter(Boolean).join(' · ')
      const sev: Severity = hits.some(h => h.kind !== 'ansi' && (h.hidden?.trim().length ?? 0) >= 3) ? 'critical' : 'high'
      const kinds = hits.map(h => `${L(KIND[h.kind][0], KIND[h.kind][1])} ×${h.count}`).join(', ')
      out.push(mk({
        ruleId: 'MCPS-TP-003', category: 'tool-poisoning', severity: sev, server: serverName,
        title: hidden ? L(`Texto oculto en ${where}: "${hidden.slice(0, 60)}"`, `Hidden text in ${where}: "${hidden.slice(0, 60)}"`) : L(`Caracteres invisibles o de control en ${where}`, `Invisible or control characters in ${where}`),
        detail: L(`Detectado: ${kinds}. Estos caracteres no se ven en pantalla pero el tokenizador del modelo sí los lee, así que pueden llevar instrucciones que el usuario nunca aprueba (ASCII smuggling). Las secuencias ANSI pueden falsear lo que muestra un cliente de terminal.`,
          `Detected: ${kinds}. These characters are invisible on screen but the model's tokenizer reads them, so they can carry instructions the user never approves (ASCII smuggling). ANSI sequences can spoof what a terminal client displays.`),
        evidence: hidden ? `${L('decodificado', 'decoded')}: ${hidden.slice(0, 200)} | raw: ${visible(value, 120)}` : visible(value),
        location: `mcpServers.${serverName}.${where}`,
        remediation: L('Elimina el servidor o normaliza el texto: rechaza U+E0000–E007F, selectores de variación en serie y caracteres de control antes de pasar descripciones al modelo; fija el hash del inventario de herramientas.',
          'Remove the server or normalise the text: reject U+E0000–E007F, runs of variation selectors and control characters before passing descriptions to the model; pin the tool-inventory hash.'),
        cwe: 'CWE-1427',
      }))
    }
    return out
  },
}

export const smugglingRules: Rule[] = [asciiSmuggling]
