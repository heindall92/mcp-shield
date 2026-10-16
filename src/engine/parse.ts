import type { McpConfig, McpServerConfig, McpToolDefinition } from '../types/mcp.types'
import type { Lang } from '../i18n/lang'
import { pick } from '../i18n/lang'

/** 1 MiB is ~100× a large real mcp.json; bigger input is refused before parsing. */
export const MAX_INPUT_BYTES = 1024 * 1024
export const MAX_SERVERS = 500

export interface ParseResult { config?: McpConfig; error?: string; warnings: string[]; format?: string }

/** Remove // and /* *\/ comments and trailing commas outside of strings (JSONC, as used by VS Code / Cursor). */
export function stripJsonc(src: string): string {
  let out = ''
  let i = 0
  let inStr = false
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    if (inStr) {
      out += c
      if (c === '\\') { out += n ?? ''; i += 2; continue }
      if (c === '"') inStr = false
      i++; continue
    }
    if (c === '"') { inStr = true; out += c; i++; continue }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 2; out += ' '; continue }
    out += c; i++
  }
  // trailing commas: , followed by whitespace then } or ] (strings already preserved above, re-scan safely)
  let res = '', s = false
  for (let k = 0; k < out.length; k++) {
    const c = out[k]
    if (s) { res += c; if (c === '\\') { res += out[++k] ?? '' } else if (c === '"') s = false; continue }
    if (c === '"') { s = true; res += c; continue }
    if (c === ',') { let j = k + 1; while (j < out.length && /\s/.test(out[j])) j++; if (out[j] === '}' || out[j] === ']') continue }
    res += c
  }
  return res
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const strMap = (v: unknown, where: string, warn: (s: string) => void): Record<string, string> | undefined => {
  if (v === undefined) return undefined
  if (!isObj(v)) { warn(where); return undefined }
  const o: Record<string, string> = {}
  for (const [k, x] of Object.entries(v)) if (x !== null && x !== undefined) o[k] = typeof x === 'string' ? x : JSON.stringify(x)
  return o
}

/** Parse any common MCP client config into the canonical { mcpServers } shape. Never throws. */
export function parseMcp(text: string, lang: Lang = 'es'): ParseResult {
  const L = (es: string, en: string) => pick(lang, es, en)
  const warnings: string[] = []
  try {
    if (typeof text !== 'string') return { error: L('Entrada no válida.', 'Invalid input.'), warnings }
    const bytes = new Blob([text]).size
    if (bytes > MAX_INPUT_BYTES) return { error: L(`Archivo demasiado grande (${(bytes / 1048576).toFixed(1)} MB). Límite: 1 MB.`, `File too large (${(bytes / 1048576).toFixed(1)} MB). Limit: 1 MB.`), warnings }
    const src = text.replace(/^\uFEFF/, '').trim()
    if (!src) return { error: L('El archivo está vacío.', 'The file is empty.'), warnings }
    let j: unknown
    try { j = JSON.parse(src) } catch {
      try { j = JSON.parse(stripJsonc(src)); warnings.push(L('Se aceptaron comentarios / comas finales (JSONC).', 'Accepted comments / trailing commas (JSONC).')) } catch (e) {
        const m = /position (\d+)/.exec((e as Error).message)
        const pos = m ? Number(m[1]) : -1
        const line = pos >= 0 ? stripJsonc(src).slice(0, pos).split('\n').length : 0
        return { error: L(`JSON no válido${line ? ` (línea ${line})` : ''}: revisa comillas, llaves y comas.`, `Invalid JSON${line ? ` (line ${line})` : ''}: check quotes, braces and commas.`), warnings }
      }
    }
    if (!isObj(j)) return { error: L('Se esperaba un objeto JSON con "mcpServers" o "servers".', 'Expected a JSON object with "mcpServers" or "servers".'), warnings }
    // Claude Desktop / Cursor / Windsurf: mcpServers · VS Code .vscode/mcp.json: servers · VS Code settings.json: mcp.servers
    let raw: unknown, format = ''
    if (isObj(j.mcpServers)) { raw = j.mcpServers; format = 'mcpServers' }
    else if (isObj(j.servers)) { raw = j.servers; format = 'servers (VS Code)' }
    else if (isObj(j.mcp) && isObj((j.mcp as Record<string, unknown>).servers)) { raw = (j.mcp as Record<string, unknown>).servers; format = 'mcp.servers (VS Code settings)' }
    else if ('mcpServers' in j || 'servers' in j) return { error: L('"mcpServers" debe ser un objeto { "nombre": { … } }.', '"mcpServers" must be an object { "name": { … } }.'), warnings }
    else return { error: L('Falta la clave raíz "mcpServers" (Claude/Cursor) o "servers" (VS Code).', 'Missing root key "mcpServers" (Claude/Cursor) or "servers" (VS Code).'), warnings }
    const entries = Object.entries(raw as Record<string, unknown>)
    if (entries.length > MAX_SERVERS) return { error: L(`Demasiados servidores (${entries.length}). Límite: ${MAX_SERVERS}.`, `Too many servers (${entries.length}). Limit: ${MAX_SERVERS}.`), warnings }
    const mcpServers: Record<string, McpServerConfig> = {}
    for (const [name, v] of entries) {
      if (!isObj(v)) { warnings.push(L(`"${name}" no es un objeto; se ignora.`, `"${name}" is not an object; ignored.`)); continue }
      const s: McpServerConfig = {}
      if (typeof v.command === 'string') s.command = v.command
      else if (v.command !== undefined) warnings.push(L(`"${name}.command" no es texto.`, `"${name}.command" is not a string.`))
      if (Array.isArray(v.args)) s.args = v.args.filter(a => a !== null && a !== undefined).map(a => (typeof a === 'string' ? a : String(a)))
      else if (typeof v.args === 'string') s.args = [v.args]
      if (typeof v.url === 'string') s.url = v.url
      else if (typeof v.serverUrl === 'string') s.url = v.serverUrl // Windsurf
      if (typeof v.type === 'string') s.type = v.type
      else if (typeof v.transport === 'string') s.type = v.transport
      const env = strMap(v.env, L(`"${name}.env" no es un objeto.`, `"${name}.env" is not an object.`), w => warnings.push(w)); if (env) s.env = env
      const headers = strMap(v.headers, L(`"${name}.headers" no es un objeto.`, `"${name}.headers" is not an object.`), w => warnings.push(w)); if (headers) s.headers = headers
      if (Array.isArray(v.tools)) s.tools = v.tools.filter(isObj).map(t => ({ name: String(t.name ?? '?'), description: typeof t.description === 'string' ? t.description : undefined, inputSchema: isObj(t.inputSchema) ? t.inputSchema : undefined }) as McpToolDefinition)
      if (!s.command && !s.url) warnings.push(L(`"${name}" no tiene "command" ni "url".`, `"${name}" has neither "command" nor "url".`))
      mcpServers[name] = s
    }
    // A bare tools/list snapshot pasted at root is also accepted
    return { config: { mcpServers }, warnings, format }
  } catch {
    return { error: L('No se pudo analizar el archivo.', 'Could not parse the file.'), warnings }
  }
}
