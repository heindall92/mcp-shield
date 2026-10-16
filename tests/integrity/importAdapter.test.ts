import { describe, it, expect } from 'vitest'
import { importCapture } from '../../src/integrity/capture/importAdapter'
import { LIMITS } from '../../src/integrity/capture/limits'
import { demoBaseline } from '../../src/integrity/demo/demoSnapshots'

const ctx = { profileId: 'p', authContextId: 'a', serverLabel: 's', protocolVersion: '2026-07-28', transport: 'stdio' as const }
const tool = (name: string, extra: Record<string, unknown> = {}) => ({ name, description: 'd', inputSchema: { type: 'object' }, ...extra })
const page = (tools: unknown[], nextCursor?: string, more: Record<string, unknown> = {}) => ({ jsonrpc: '2.0', id: 1, result: { tools, ttlMs: 1000, cacheScope: 'public', ...(nextCursor ? { nextCursor } : {}), ...more } })
const codes = (r: { issues: { code: string }[] }) => r.issues.map(i => i.code)

describe('Capture adapter', () => {
  it('imports a single tools/list response', () => {
    const r = importCapture(JSON.stringify(page([tool('a'), tool('b')])), ctx)
    expect(r.kind).toBe('jsonrpc'); expect(r.snapshot?.tools.map(t => t.name)).toEqual(['a', 'b'])
    expect(r.snapshot?.capture).toMatchObject({ completeness: 'pagination-complete', pageCount: 1, toolCount: 2, ttlMs: 1000, cacheScope: 'public' })
  })
  it('imports paged responses following cursors', () => {
    const r = importCapture(JSON.stringify([page([tool('a')], 'c1'), { request: { params: { cursor: 'c1' } }, response: page([tool('b')], undefined, { cacheScope: 'private', ttlMs: 10 }) }]), ctx)
    expect(r.kind).toBe('pages'); expect(r.snapshot?.capture).toMatchObject({ completeness: 'pagination-complete', pageCount: 2, ttlMs: 10, cacheScope: 'private' })
  })
  it('requires capture context for JSON-RPC input', () => { expect(codes(importCapture(JSON.stringify(page([tool('a')]))))).toContain('missing-context') })
  it('rejects circular cursors', () => { expect(codes(importCapture(JSON.stringify([page([tool('a')], 'x'), page([tool('b')], 'x')]), ctx))).toContain('circular-cursor') })
  it('marks trailing nextCursor as partial', () => { const r = importCapture(JSON.stringify(page([tool('a')], 'more')), ctx); expect(r.snapshot?.capture.completeness).toBe('partial') })
  it('marks cursor gaps as partial', () => { const r = importCapture(JSON.stringify([page([tool('a')], 'c1'), { request: { params: { cursor: 'zz' } }, response: page([tool('b')]) }]), ctx); expect(r.snapshot?.capture.completeness).toBe('partial'); expect(codes(r)).toContain('cursor-gap') })
  it('treats non-complete resultType as partial', () => { expect(importCapture(JSON.stringify(page([tool('a')], undefined, { resultType: 'input_required' })), ctx).snapshot?.capture.completeness).toBe('partial') })
  it('rejects duplicate names but keeps case-sensitive distinct names', () => {
    expect(codes(importCapture(JSON.stringify(page([tool('a'), tool('a')])), ctx))).toContain('duplicate-name')
    expect(importCapture(JSON.stringify(page([tool('a'), tool('A')])), ctx).snapshot?.tools).toHaveLength(2)
  })
  it('enforces size, depth, tool and page limits', () => {
    expect(codes(importCapture('x'.repeat(LIMITS.maxBytes + 1), ctx))).toEqual(['size'])
    expect(codes(importCapture('['.repeat(70) + ']'.repeat(70), ctx))).toEqual(['depth'])
    expect(codes(importCapture(JSON.stringify(page(Array.from({ length: 1001 }, (_, i) => tool('t' + i)))), ctx))).toContain('tools-limit')
    expect(codes(importCapture(JSON.stringify(Array.from({ length: 129 }, (_, i) => page([tool('t' + i)], 'c' + i))), ctx))).toContain('pages-limit')
  })
  it('rejects JSON-RPC errors, bad JSON, empty input', () => {
    expect(codes(importCapture(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'x' } }), ctx))).toContain('rpc-error')
    expect(codes(importCapture('{bad', ctx))).toEqual(['json']); expect(codes(importCapture('  ', ctx))).toEqual(['empty'])
  })
  it('never loads icons or external $ref, only warns', () => {
    const r = importCapture(JSON.stringify(page([tool('a', { icons: [{ src: 'https://evil.example/i.png' }], inputSchema: { type: 'object', properties: { x: { $ref: 'https://evil.example/s.json' } } } })])), ctx)
    expect(codes(r)).toEqual(expect.arrayContaining(['icon-url', 'external-ref'])); expect(r.snapshot).toBeDefined()
  })
  it('preserves Unicode and keeps unknown keys in extensions', () => {
    const d = 'Cafe\u0301 \u200B \u{E0041}'
    const r = importCapture(JSON.stringify(page([tool('a', { description: d, weird: 1 })])), ctx)
    expect(r.snapshot?.tools[0].description).toBe(d); expect(r.snapshot?.tools[0].extensions).toEqual({ weird: 1 })
  })
  it('imports native snapshots and never trusts verifiedCollector', () => {
    const s = { ...demoBaseline(), provenance: { source: 'local-collector', verifiedCollector: true } }
    const r = importCapture(JSON.stringify(s)); expect(r.kind).toBe('native'); expect(r.snapshot?.provenance.verifiedCollector).toBe(false)
  })
  it('rejects native toolCount mismatch and wrong schemaVersion', () => {
    const s = demoBaseline()
    expect(codes(importCapture(JSON.stringify({ ...s, capture: { ...s.capture, toolCount: 99 } })))).toContain('count-mismatch')
    expect(codes(importCapture(JSON.stringify({ ...s, schemaVersion: '2.0' })))).toContain('format-version')
  })
  it('warns on unknown protocol versions', () => { expect(codes(importCapture(JSON.stringify(page([tool('a')])), { ...ctx, protocolVersion: '2099-01-01' }))).toContain('unknown-protocol') })
})
