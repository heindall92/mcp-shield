import { describe, it, expect } from 'vitest'
import { schemaDiff } from '../../src/integrity/diff/schemaDiff'
import { compare } from '../../src/integrity/diff/comparator'
import { decide, DecisionError, TOFU_CHECKLIST } from '../../src/integrity/domain/decisions'
import { sealBaseline, openBaseline, keyToB64 } from '../../src/integrity/crypto/encryptedBaseline'
import { generateHmacKey } from '../../src/integrity/crypto/hashes'
import { createIntegrityStore } from '../../src/integrity/store'
import { demoBaseline, demoCandidate } from '../../src/integrity/demo/demoSnapshots'

// Regression tests for the v1.3.3 review of the Integrity Monitor. Each failed before its fix.
const root = 'a'.repeat(64)

describe('R1: integrity state survives tab switches (store above the view)', () => {
  it('keeps snapshots, key and decisions until reset', async () => {
    const s = createIntegrityStore(); const key = await generateHmacKey()
    s.set({ key, baseline: { snap: demoBaseline(), approved: true, provisional: false }, candidate: demoCandidate(), log: [] })
    // a "remount" of the view only reads the store again
    const again = s.get(); expect(again.baseline?.snap.snapshotId).toBe('demo-baseline-2026-10-01'); expect(again.key).toBe(key); expect(again.candidate).toBeDefined()
    s.reset(); expect(s.get().baseline).toBeUndefined(); expect(s.get().candidate).toBeUndefined(); expect(s.get().log).toEqual([]); expect(s.get().key).toBeUndefined()
  })
  it('notifies subscribers and never touches storage', () => {
    const s = createIntegrityStore(); let n = 0; const off = s.subscribe(() => n++)
    s.set({ log: [] }); off(); s.set({ log: [] }); expect(n).toBe(1)
    expect(JSON.stringify(s.get())).not.toContain('localStorage')
  })
})

describe('R2: conservative schema compatibility', () => {
  const sch = (p: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ type: 'object', properties: { x: p }, ...extra })
  it('removing a oneOf/anyOf option is a restriction, adding one an expansion', () => {
    const a = sch({ anyOf: [{ type: 'string' }, { type: 'number' }] })
    expect(schemaDiff(a, sch({ anyOf: [{ type: 'string' }] })).expanded).toEqual([])
    expect(schemaDiff(a, sch({ anyOf: [{ type: 'string' }] })).restricted.length).toBe(1)
    expect(schemaDiff(a, sch({ anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] })).expanded.length).toBe(1)
    expect(schemaDiff(sch({ oneOf: [{ type: 'string' }] }), sch({ oneOf: [{ type: 'integer' }] })).unknown.length).toBe(1)
  })
  it('numeric and length bounds follow direction', () => {
    expect(schemaDiff(sch({ maxLength: 10 }), sch({ maxLength: 20 })).expanded.length).toBe(1)
    expect(schemaDiff(sch({ maxLength: 20 }), sch({ maxLength: 10 })).restricted.length).toBe(1)
    expect(schemaDiff(sch({ minimum: 0 }), sch({ minimum: 5 })).restricted.length).toBe(1)
    expect(schemaDiff(sch({ minimum: 5 }), sch({ minimum: 0 })).expanded.length).toBe(1)
    expect(schemaDiff(sch({}), sch({ maxLength: 5 })).restricted.length).toBe(1)
  })
  it('pattern changes are unknown; enum add/remove; required add/remove; additionalProperties', () => {
    expect(schemaDiff(sch({ pattern: '^a' }), sch({ pattern: '^b' })).unknown.length).toBe(1)
    expect(schemaDiff(sch({ enum: ['a', 'b'] }), sch({ enum: ['a'] })).restricted.length).toBe(1)
    expect(schemaDiff(sch({ enum: ['a'] }), sch({ enum: ['a', 'b'] })).expanded.length).toBe(1)
    expect(schemaDiff(sch({}, { required: ['x'] }), sch({})).expanded.some(p => p.includes('required'))).toBe(true)
    expect(schemaDiff(sch({}), sch({}, { required: ['x'] })).restricted.some(p => p.includes('required'))).toBe(true)
    expect(schemaDiff(sch({}, { additionalProperties: false }), sch({}, { additionalProperties: true })).expanded.length).toBe(1)
    expect(schemaDiff(sch({}, { additionalProperties: { type: 'string' } }), sch({}, { additionalProperties: { type: 'number' } })).unknown.length).toBe(1)
  })
  it('restriction-only change is SCHEMA_CHANGED (breaking), never INPUT_EXPANDED; unknown has low confidence', () => {
    const b = demoBaseline(), c = demoBaseline()
    ;(c.tools[0].inputSchema.properties as Record<string, Record<string, unknown>>).subject.maxLength = 100
    const ev = compare(b, c).events; expect(ev.map(e => e.type)).toEqual(['SCHEMA_CHANGED']); expect(ev[0].notes).toContain('breaking')
    const d = demoBaseline(); (d.tools[0].inputSchema.properties as Record<string, Record<string, unknown>>).to.format = 'uri'
    const e2 = compare(b, d).events; expect(e2[0].type).toBe('SCHEMA_CHANGED'); expect(e2[0].notes).toContain('unknown'); expect(e2[0].confidence).toBe('low')
  })
})

describe('R3: TOFU requires a complete capture for a full baseline', () => {
  const base = { candidateRoot: root, candidateSnapshotId: 'x', comparable: true, tofu: TOFU_CHECKLIST }
  it('rejects full approval of a partial capture', () => {
    expect(() => decide([], { ...base, decision: 'approved', completeness: 'partial' })).toThrow(DecisionError)
    expect(() => decide([], { ...base, decision: 'approved', completeness: 'partial' })).toThrow('partial')
  })
  it('allows a clearly distinct provisional baseline', () => {
    const log = decide([], { ...base, decision: 'provisional', completeness: 'partial' })
    expect(log[0].decision).toBe('provisional'); expect(log[0].provisional).toBe(true)
    expect(() => decide([], { ...base, decision: 'provisional', completeness: 'pagination-complete' })).toThrow('provisional')
  })
  it('a provisional baseline never yields TOOL_REMOVED from its own gaps and flags additions as low confidence', () => {
    const b = demoBaseline(); b.capture.completeness = 'partial'; b.tools.pop()
    const c = demoBaseline()
    const r = compare(b, c)
    expect(r.comparability.warnings).toContain('provisional-baseline')
    const add = r.events.find(e => e.type === 'TOOL_ADDED')!; expect(add.confidence).toBe('low'); expect(add.notes).toContain('provisional-baseline')
  })
})

describe('R4: decrypted payload is validated before use', () => {
  const pw = 'correct horse battery'
  const seal = async (payload: unknown) => JSON.stringify(await sealBaseline(payload as never, pw, { iterations: 100_000 }))
  it('rejects a tampered-but-authentic payload (bad snapshot / key / decisions)', async () => {
    const k = keyToB64((await generateHmacKey()).raw)
    const s = demoBaseline()
    for (const bad of [
      { snapshot: { ...s, capture: { ...s.capture, toolCount: 99 } }, hmacKey: k, decisions: [] },
      { snapshot: { ...s, tools: [...s.tools, s.tools[0]] , capture: { ...s.capture, toolCount: 5 } }, hmacKey: k, decisions: [] },
      { snapshot: s, hmacKey: 'AAAA', decisions: [] },
      { snapshot: s, hmacKey: k, decisions: [{ decision: 'auto-approved', candidateRoot: 'x' }] },
      { snapshot: s, hmacKey: k, decisions: 'nope' },
      { snapshot: 'x', hmacKey: k, decisions: [] },
    ]) await expect(openBaseline(await seal(bad), pw)).rejects.toMatchObject({ code: 'payload' })
  })
  it('is proto-safe and forces verifiedCollector false', async () => {
    const k = keyToB64((await generateHmacKey()).raw)
    const s = { ...demoBaseline(), provenance: { source: 'local-collector', verifiedCollector: true } }
    const text = (await seal({ snapshot: s, hmacKey: k, decisions: [] }))
    const p = await openBaseline(text, pw)
    expect(p.snapshot.provenance.verifiedCollector).toBe(false); expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
