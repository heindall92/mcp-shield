import { canonicalize } from './canonicalize'
import type { MCPShieldSnapshot, DecisionRecord } from '../domain/types'

/**
 * Optional encrypted baseline package (RFC-001 §6.2): AES-256-GCM, key derived from a password with
 * PBKDF2-HMAC-SHA-256 (WebCrypto has no Argon2/scrypt). Parameters are versioned in the header, which
 * is bound as additional authenticated data. The password is never stored; only the file the user downloads persists.
 */
export const PACKAGE_FORMAT = 'mcp-shield-baseline'
export const PACKAGE_VERSION = 1
/** OWASP Password Storage Cheat Sheet (2023+) recommends >= 600,000 iterations for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000
export const MIN_PASSWORD = 12
const MAX_ITERATIONS = 10_000_000

export interface BaselinePayload { snapshot: MCPShieldSnapshot; hmacKey: string; decisions: DecisionRecord[] }
export interface PackageHeader {
  format: typeof PACKAGE_FORMAT; version: number; createdAt: string; profileId: string
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; length: 256; iv: string }
}
export interface BaselinePackage extends PackageHeader { ciphertext: string }
export type PackageErrorCode = 'password' | 'format' | 'auth' | 'params'
export class PackageError extends Error { override name = 'PackageError'; code: PackageErrorCode; constructor(code: PackageErrorCode) { super(code); this.code = code } }

const b64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s) }
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const enc = new TextEncoder()

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
const aad = (h: PackageHeader) => enc.encode(canonicalize(h))

export async function sealBaseline(payload: BaselinePayload, password: string, opts: { iterations?: number; now?: string } = {}): Promise<BaselinePackage> {
  if (password.length < MIN_PASSWORD) throw new PackageError('password')
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
  const header: PackageHeader = { format: PACKAGE_FORMAT, version: PACKAGE_VERSION, createdAt: opts.now ?? new Date().toISOString(), profileId: payload.snapshot.target.profileId,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: opts.iterations ?? PBKDF2_ITERATIONS, salt: b64(salt) }, cipher: { name: 'AES-GCM', length: 256, iv: b64(iv) } }
  const key = await deriveKey(password, salt, header.kdf.iterations)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(header) as BufferSource, tagLength: 128 }, key, enc.encode(canonicalize(payload)))
  return { ...header, ciphertext: b64(new Uint8Array(ct)) }
}

export async function openBaseline(text: string, password: string): Promise<BaselinePayload> {
  let p: BaselinePackage
  try { p = JSON.parse(text) } catch { throw new PackageError('format') }
  if (!p || p.format !== PACKAGE_FORMAT || p.version !== PACKAGE_VERSION || p.cipher?.name !== 'AES-GCM' || p.cipher.length !== 256 || p.kdf?.name !== 'PBKDF2' || p.kdf.hash !== 'SHA-256') throw new PackageError('format')
  if (!Number.isInteger(p.kdf.iterations) || p.kdf.iterations < 100_000 || p.kdf.iterations > MAX_ITERATIONS) throw new PackageError('params')
  const { ciphertext, ...header } = p
  let salt: Uint8Array, iv: Uint8Array, ct: Uint8Array
  try { salt = unb64(header.kdf.salt); iv = unb64(header.cipher.iv); ct = unb64(ciphertext) } catch { throw new PackageError('format') }
  if (salt.length < 16 || iv.length !== 12) throw new PackageError('params')
  const key = await deriveKey(password, salt, header.kdf.iterations)
  let plain: ArrayBuffer
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(header) as BufferSource, tagLength: 128 }, key, ct as BufferSource) } catch { throw new PackageError('auth') }
  return JSON.parse(new TextDecoder().decode(plain)) as BaselinePayload
}
export const keyToB64 = b64
export const keyFromB64 = unb64
