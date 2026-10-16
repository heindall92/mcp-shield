import { describe, it, expect } from 'vitest'
import { fingerprint, generateHmacKey, importHmacKey, publicProjection } from '../../src/integrity/crypto/hashes'
import { sealBaseline, openBaseline, PackageError, keyToB64 } from '../../src/integrity/crypto/encryptedBaseline'
import { demoBaseline, demoCandidate } from '../../src/integrity/demo/demoSnapshots'

describe('fingerprints', () => {
  it('is independent of key order and tool order', async () => {
    const k = await generateHmacKey(); const s = demoBaseline()
    const r = { ...s, tools: [...s.tools].reverse().map(t => Object.fromEntries(Object.entries(t).reverse()) as typeof t) }
    const [a, b] = await Promise.all([fingerprint(s, k), fingerprint(r, k)]); expect(a.root).toBe(b.root); expect(a.publicRoot).toBe(b.publicRoot)
  })
  it('one invisible character changes the tool HMAC', async () => {
    const k = await generateHmacKey(); const s = demoBaseline(); const t = structuredClone(s)
    t.tools[0].description += '\u200B'
    const [a, b] = await Promise.all([fingerprint(s, k), fingerprint(t, k)])
    expect(a.tools.find(x => x.name === 'send_email')!.hmac).not.toBe(b.tools.find(x => x.name === 'send_email')!.hmac); expect(a.root).not.toBe(b.root)
  })
  it('root binds profile and auth context', async () => {
    const k = await generateHmacKey(); const s = demoBaseline()
    const a = await fingerprint(s, k), b = await fingerprint({ ...s, target: { ...s.target, authContextId: 'other' } }, k)
    expect(a.root).not.toBe(b.root); expect(a.publicRoot).toBe(b.publicRoot)
  })
  it('different keys give different HMACs; public hash is key-independent', async () => {
    const s = demoBaseline(); const a = await fingerprint(s, await generateHmacKey()), b = await fingerprint(s, await generateHmacKey())
    expect(a.root).not.toBe(b.root); expect(a.publicRoot).toBe(b.publicRoot)
  })
  it('rejects short keys and keeps CryptoKey non-extractable', async () => {
    await expect(importHmacKey(new Uint8Array(16))).rejects.toThrow(); expect((await generateHmacKey()).key.extractable).toBe(false)
  })
  it('public projection redacts secrets and drops _meta', () => {
    const p = JSON.stringify(publicProjection({ name: 'x', description: 'use sk-FAKE-abcdefghijklmnopqrstuvwxyz0123', inputSchema: { type: 'object' }, _meta: { a: 1 } }))
    expect(p).not.toContain('sk-FAKE-abcdefghijklmnopqrstuvwxyz0123'); expect(p).not.toContain('_meta')
  })
})

describe('encrypted baseline package', () => {
  const payload = async () => { const k = await generateHmacKey(); return { snapshot: demoCandidate(), hmacKey: keyToB64(k.raw), decisions: [] } }
  it('round-trips and preserves Unicode', async () => {
    const p = await payload(); const pkg = await sealBaseline(p, 'correct horse battery', { iterations: 100_000 })
    const text = JSON.stringify(pkg); expect(text).not.toContain('send_email'); expect(text).not.toContain('correct horse')
    const back = await openBaseline(text, 'correct horse battery'); expect(back).toEqual(p)
  })
  it('wrong password fails with auth', async () => {
    const pkg = await sealBaseline(await payload(), 'correct horse battery', { iterations: 100_000 })
    await expect(openBaseline(JSON.stringify(pkg), 'wrong password!!')).rejects.toMatchObject({ code: 'auth' })
  })
  it('tampered header (AAD) or ciphertext fails', async () => {
    const pkg = await sealBaseline(await payload(), 'correct horse battery', { iterations: 100_000 })
    await expect(openBaseline(JSON.stringify({ ...pkg, createdAt: '1999-01-01T00:00:00Z' }), 'correct horse battery')).rejects.toBeInstanceOf(PackageError)
    const c = pkg.ciphertext; const flip = (c[5] === 'A' ? 'B' : 'A')
    await expect(openBaseline(JSON.stringify({ ...pkg, ciphertext: c.slice(0, 5) + flip + c.slice(6) }), 'correct horse battery')).rejects.toBeInstanceOf(PackageError)
  })
  it('rejects short passwords, bad params and junk', async () => {
    await expect(sealBaseline(await payload(), 'short')).rejects.toMatchObject({ code: 'password' })
    const pkg = await sealBaseline(await payload(), 'correct horse battery', { iterations: 100_000 })
    await expect(openBaseline(JSON.stringify({ ...pkg, kdf: { ...pkg.kdf, iterations: 10 } }), 'correct horse battery')).rejects.toMatchObject({ code: 'params' })
    await expect(openBaseline('nope', 'correct horse battery')).rejects.toMatchObject({ code: 'format' })
  })
})
