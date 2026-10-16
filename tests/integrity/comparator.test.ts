import { describe, it, expect } from 'vitest'
import { compare } from '../../src/integrity/diff/comparator'
import { analyze } from '../../src/integrity/analysis'
import { confusables } from '../../src/integrity/rules/integrityRules'
import { generateHmacKey } from '../../src/integrity/crypto/hashes'
import { decide, stateOf, TOFU_CHECKLIST } from '../../src/integrity/domain/decisions'
import { exportJson, exportSarif, exportMarkdown } from '../../src/integrity/evidence/integrityExporter'
import { demoBaseline, demoCandidate, demoOtherContext } from '../../src/integrity/demo/demoSnapshots'
import type { MCPShieldSnapshot } from '../../src/integrity/domain/types'

const types = (s: MCPShieldSnapshot, b = demoBaseline()) => compare(b, s).events.map(e => `${e.type}:${e.tool ?? ''}`)
const mut = (f: (s: MCPShieldSnapshot) => void) => { const s = demoBaseline(); f(s); return s }

describe('comparator (RFC-001 §13.1)', () => {
  it('identical inventories produce no events', () => { expect(types(demoBaseline())).toEqual([]) })
  it('reordering tools/keys produces no events', () => { expect(types(mut(s => s.tools.reverse()))).toEqual([]) })
  it('new tool -> TOOL_ADDED', () => { expect(types(mut(s => s.tools.push({ name: 'x', inputSchema: { type: 'object' } })))).toEqual(['TOOL_ADDED:x']) })
  it('removed tool in complete capture -> TOOL_REMOVED', () => { expect(types(mut(s => s.tools.pop()))).toEqual(['TOOL_REMOVED:list_labels']) })
  it('removed tool in partial capture -> no TOOL_REMOVED', () => {
    const s = mut(x => { x.tools.pop(); x.capture.completeness = 'partial' }); const c = compare(demoBaseline(), s)
    expect(c.events).toEqual([]); expect(c.unconfirmedMissing).toEqual(['list_labels'])
  })
  it('description change -> DESCRIPTION_CHANGED', () => { expect(types(mut(s => { s.tools[1].description = 'Other' }))).toEqual(['DESCRIPTION_CHANGED:search_inbox']) })
  it('new optional param -> INPUT_EXPANDED', () => { expect(types(mut(s => { (s.tools[2].inputSchema.properties as Record<string, unknown>).x = { type: 'string' } }))).toEqual(['INPUT_EXPANDED:read_message']) })
  it('removed maximum / opened additionalProperties / widened enum -> INPUT_EXPANDED', () => {
    expect(types(mut(s => { delete ((s.tools[1].inputSchema.properties as Record<string, Record<string, unknown>>).limit).maximum }))).toContain('INPUT_EXPANDED:search_inbox')
    expect(types(mut(s => { s.tools[0].inputSchema.additionalProperties = true }))).toContain('INPUT_EXPANDED:send_email')
    const b = mut(s => { (s.tools[3].inputSchema as Record<string, unknown>).properties = { k: { enum: ['a'] } } })
    expect(types(mut(s => { (s.tools[3].inputSchema as Record<string, unknown>).properties = { k: { enum: ['a', 'b'] } } }), b)).toContain('INPUT_EXPANDED:list_labels')
  })
  it('new required param -> SCHEMA_CHANGED breaking', () => {
    const s = mut(x => { (x.tools[2].inputSchema.required as string[]).length = 0 }); const b = demoBaseline()
    const e = compare(s, b).events.find(x => x.type === 'SCHEMA_CHANGED'); expect(e?.notes).toContain('breaking')
  })
  it('annotation change -> ANNOTATION_CHANGED', () => { expect(types(mut(s => { s.tools[1].annotations = { readOnlyHint: false } }))).toEqual(['ANNOTATION_CHANGED:search_inbox']) })
  it('invisible char -> INVISIBLE_PAYLOAD (also via HMAC)', () => { expect(types(mut(s => { s.tools[1].description += '\u200B' }))).toContain('INVISIBLE_PAYLOAD:search_inbox') })
  it('_meta change -> INTEGRITY_MISMATCH', () => { expect(types(mut(s => { s.tools[1]._meta = { x: 1 } }))).toEqual(['INTEGRITY_MISMATCH:search_inbox']) })
  it('different authContextId -> CONTEXT_MISMATCH blocks the diff', () => {
    const c = compare(demoBaseline(), mut(s => { s.target.authContextId = 'admin'; s.tools.pop() }))
    expect(c.comparability.comparable).toBe(false); expect(c.events.map(e => e.type)).toEqual(['CONTEXT_MISMATCH'])
  })
  it('different profile or transport also blocks; protocol change only warns', () => {
    expect(compare(demoBaseline(), mut(s => { s.target.profileId = 'x' })).comparability.blockers).toEqual(['profileId'])
    expect(compare(demoBaseline(), mut(s => { s.target.transport = 'stdio' })).comparability.blockers).toEqual(['transport'])
    expect(compare(demoBaseline(), mut(s => { s.target.protocolVersion = '2025-11-25' })).comparability).toMatchObject({ comparable: true, warnings: ['protocolVersion'] })
  })
  it('case-sensitive names: Send_Email is a new tool, not a modification', () => { expect(types(mut(s => { s.tools.push({ ...s.tools[0], name: 'Send_Email' }) }))).toEqual(['TOOL_ADDED:Send_Email']) })
  it('x-mcp-header change is flagged', () => {
    const e = compare(demoBaseline(), mut(s => { ((s.tools[2].inputSchema.properties as Record<string, Record<string, unknown>>).id)['x-mcp-header'] = 'X-Id' })).events
    expect(e.some(x => x.notes.includes('x-mcp-header'))).toBe(true)
  })
})

describe('demo pair + rules + risks', () => {
  it('detects the send_email rug pull', async () => {
    const a = await analyze(demoCandidate(), demoBaseline(), await generateHmacKey(), 'en')
    const ids = new Set(a.findings.map(f => f.ruleId))
    for (const id of ['MCPS-INT-001', 'MCPS-INT-002', 'MCPS-INT-003', 'MCPS-INT-004', 'MCPS-INT-005', 'MCPS-INT-006', 'MCPS-INT-008']) expect(ids, id).toContain(id)
    expect(a.events.map(e => e.type)).toContain('TOOL_REMOVED')
    expect(a.findings.find(f => f.ruleId === 'MCPS-INT-005')?.severity).toBe('critical')
    expect(a.configRisk.findings.map(f => f.ruleId)).toEqual(expect.arrayContaining(['MCPS-TP-001', 'MCPS-TP-003']))
    expect(a.integrityRisk).toBeGreaterThan(0); expect(a.coverage.every(c => c.status !== 'NOT_EVALUATED')).toBe(true)
  })
  it('decoded tag payload is shown, not executed', async () => {
    const a = await analyze(demoCandidate(), demoBaseline(), await generateHmacKey(), 'en')
    const e = a.events.find(x => x.type === 'INVISIBLE_PAYLOAD' && x.tool === 'send_email')!
    expect(e.changes.find(c => c.path === 'decoded')?.after).toContain('id_rsa')
  })
  it('context mismatch leaves INT rules NOT_EVALUATED', async () => {
    const a = await analyze(demoOtherContext(), demoBaseline(), await generateHmacKey(), 'es')
    expect(a.comparability.comparable).toBe(false); expect(a.coverage.every(c => c.status === 'NOT_EVALUATED')).toBe(true)
  })
  it('first baseline: no INT evaluation, TP still evaluated', async () => {
    const a = await analyze(demoCandidate(), undefined, await generateHmacKey(), 'es')
    expect(a.firstBaseline).toBe(true); expect(a.events).toEqual([]); expect(a.configRisk.findings.length).toBeGreaterThan(0)
  })
  it('confusable names', () => {
    expect(confusables(['send_emaiI'], ['send_email'])).toHaveLength(1)
    expect(confusables(['rеad_file'], ['read_file'])).toHaveLength(1) // Cyrillic e
    expect(confusables(['list_labels'], ['read_message'])).toHaveLength(0)
  })
})

describe('approval', () => {
  const root = 'a'.repeat(64)
  it('first approval requires the full TOFU checklist; never auto', () => {
    expect(() => decide([], { decision: 'approved', candidateRoot: root, candidateSnapshotId: 'x', comparable: true, tofu: ['source'], completeness: 'pagination-complete' })).toThrow('tofu')
    const log = decide([], { decision: 'approved', candidateRoot: root, candidateSnapshotId: 'x', comparable: true, tofu: TOFU_CHECKLIST, completeness: 'pagination-complete' })
    expect(stateOf(log, root)).toBe('approved'); expect(stateOf(log, 'b'.repeat(64))).toBe('unreviewed'); expect(log[0].firstBaseline).toBe(true)
  })
  it('cannot approve across a context mismatch; accept-risk needs a review date', () => {
    expect(() => decide([], { decision: 'approved', candidateRoot: root, baselineRoot: root, candidateSnapshotId: 'x', comparable: false, completeness: 'pagination-complete' })).toThrow('context')
    expect(() => decide([], { decision: 'accepted-risk', candidateRoot: root, baselineRoot: root, candidateSnapshotId: 'x', comparable: true })).toThrow('reviewBy')
    expect(decide([], { decision: 'rejected', candidateRoot: root, baselineRoot: root, candidateSnapshotId: 'x', comparable: false })[0].decision).toBe('rejected')
  })
})

describe('exports', () => {
  it('pass the gate, carry no key and no raw secrets', async () => {
    const c = demoCandidate(); c.tools[1].description = 'token ghp_FAKE0123456789abcdefghijklmnopqrstuv'
    const k = await generateHmacKey(); const a = await analyze(c, demoBaseline(), k, 'en')
    for (const r of [exportJson(a, []), exportSarif(a, 'en'), exportMarkdown(a, 'en', [])]) {
      expect(r.ok, JSON.stringify(r.gate)).toBe(true); expect(r.text).not.toContain('ghp_FAKE0123456789abcdefghijklmnopqrstuv')
      expect(r.text).not.toMatch(/[\u{E0000}-\u{E007F}\u200B]/u); expect(r.text).not.toContain(Buffer.from(k.raw).toString('base64'))
    }
    expect(JSON.parse(exportSarif(a, 'en').text).version).toBe('2.1.0')
  })
})
