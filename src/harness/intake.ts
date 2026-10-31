import type { HarnessKind } from './types'

/**
 * File intake for Harness-Shield. Size and type are checked from File metadata BEFORE any byte is read;
 * a small prefix is then sniffed for binary content. Nothing is ever executed or sent anywhere.
 */
export const HS_MAX_BYTES = 5 * 1024 * 1024
export const HS_MAX_FILES = 50
/** Longer lines are scanned only up to this many characters by the pattern rules (ReDoS and UI guard). */
export const HS_MAX_LINE = 4096
export const SNIFF_BYTES = 8192

export type RejectReason = 'size' | 'binary' | 'empty' | 'too-many' | 'read'

const BINARY_MIME = /^(?:image|audio|video|font)\/|^application\/(?:zip|gzip|x-gzip|x-tar|x-7z-compressed|x-rar-compressed|pdf|x-msdownload|x-executable|x-mach-binary|vnd\.|java-archive|wasm)/i
const BINARY_EXT = /\.(?:png|jpe?g|gif|webp|bmp|ico|pdf|zip|gz|tgz|7z|rar|tar|exe|dll|so|dylib|bin|class|jar|wasm|woff2?|ttf|otf|mp[34]|mov|avi|sqlite|db|pyc)$/i

/** Metadata-only check: call before reading the file. */
export function checkMeta(name: string, size: number, type = ''): RejectReason | undefined {
  if (size > HS_MAX_BYTES) return 'size'
  if (size === 0) return 'empty'
  if (BINARY_MIME.test(type) || BINARY_EXT.test(name)) return 'binary'
  return undefined
}

/** True for NUL bytes, invalid UTF-8 or a high share of control bytes in the sniffed prefix. */
export function looksBinary(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return true
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes.length >= SNIFF_BYTES ? trimUtf8(bytes) : bytes) } catch { return true }
  let ctl = 0
  for (const b of bytes) if (b < 9 || (b > 13 && b < 32) || b === 127) ctl++
  return bytes.length > 0 && ctl / bytes.length > 0.1
}
/** A prefix cut at SNIFF_BYTES may split a multi-byte sequence: drop the incomplete tail before decoding. */
function trimUtf8(b: Uint8Array): Uint8Array {
  let end = b.length
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const c = b[end - i]
    if ((c & 0xc0) === 0x80) continue
    const need = c >= 0xf0 ? 4 : c >= 0xe0 ? 3 : c >= 0xc0 ? 2 : 1
    if (need > i) end -= i
    break
  }
  return b.subarray(0, end)
}

export function byteLength(s: string): number { return new TextEncoder().encode(s).length }

/** File kind from its name (path allowed); a shebang decides for extension-less hook scripts. */
export function detectKind(name: string, text = ''): HarnessKind {
  const n = name.replace(/\\/g, '/').toLowerCase()
  const base = n.slice(n.lastIndexOf('/') + 1)
  if (base === 'skill.md') return 'skill'
  if (base === 'claude.md' || base === 'claude.local.md') return 'claude'
  if (base === 'agents.md') return 'agents'
  if (base === '.cursorrules' || base.endsWith('.mdc') || base === '.windsurfrules' || base === '.clinerules') return 'cursorrules'
  if (base === '.mcp.json' || base === 'mcp.json' || base === 'claude_desktop_config.json') return 'mcp'
  if (/\.(?:sh|bash|zsh|ksh)$/.test(base)) return 'bash'
  if (/\.pyw?$/.test(base)) return 'python'
  if (/\.ps(?:m|d)?1$/.test(base)) return 'powershell'
  if (/\.(?:md|markdown|txt)$/.test(base)) return 'markdown'
  if (/\.jsonc?$/.test(base)) return /"(?:mcpServers|servers)"\s*:/.test(text.slice(0, 200_000)) ? 'mcp' : 'json'
  if (/\.(?:toml|ya?ml|ini|cfg|conf)$/.test(base)) return 'config'
  const she = /^#!\s?(\S+)(?:\s+(\S+))?/.exec(text.slice(0, 200))
  if (she) {
    const tail = (x: string) => x.slice(x.lastIndexOf('/') + 1)
    const prog = tail(she[1]) === 'env' ? tail(she[2] ?? '') : tail(she[1])
    if (/^(?:ba|z|k|da)?sh$/.test(prog)) return 'bash'
    if (/^python[\d.]*$/.test(prog)) return 'python'
    if (/^pwsh$/.test(prog)) return 'powershell'
  }
  return 'text'
}

export const isScript = (k: HarnessKind) => k === 'bash' || k === 'python' || k === 'powershell'
/** Machine-read files: every line is "code" for the rules (it is parsed or executed, not read as prose). */
export const isCodeKind = (k: HarnessKind) => isScript(k) || k === 'mcp' || k === 'json' || k === 'config'

/** Minimal File surface used here (lets tests prove that rejected files are never read). */
export interface FileLike { name: string; size: number; type?: string; webkitRelativePath?: string; slice(start?: number, end?: number): { arrayBuffer(): Promise<ArrayBuffer> }; text(): Promise<string> }

/** Size/type from metadata first, then an 8 KiB sniff, then the full read. Never throws. */
export async function readHarnessFile(f: FileLike): Promise<{ name: string; text?: string; kind?: HarnessKind; reason?: RejectReason }> {
  const name = (f.webkitRelativePath || f.name || 'file.txt').slice(0, 260)
  const why = checkMeta(name, f.size, f.type ?? '')
  if (why) return { name, reason: why }
  try {
    if (looksBinary(new Uint8Array(await f.slice(0, SNIFF_BYTES).arrayBuffer()))) return { name, reason: 'binary' }
    const text = await f.text()
    if (byteLength(text) > HS_MAX_BYTES) return { name, reason: 'size' }
    return { name, text, kind: detectKind(name, text) }
  } catch { return { name, reason: 'read' } }
}
