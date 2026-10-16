import { describe, it, expect } from 'vitest'
import { canonicalize, canonicalBytes } from '../../src/integrity/crypto/canonicalize'

const f64 = (hex: string) => new DataView(new Uint8Array(hex.match(/../g)!.map(h => parseInt(h, 16))).buffer).getFloat64(0)

describe('RFC 8785 test vectors', () => {
  it('§3.2.2 / §3.2.3 primitive serialization sample', () => {
    const parsed = JSON.parse('{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/","literals":[null,true,false]}')
    expect(canonicalize(parsed)).toBe('{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}')
  })
  it('§3.2.3 property sorting by UTF-16 code units', () => {
    const o = JSON.parse('{"\\u20ac":"Euro Sign","\\r":"Carriage Return","\\ufb33":"Hebrew Letter Dalet With Dagesh","1":"One","\\ud83d\\ude00":"Emoji: Grinning Face","\\u0080":"Control","\\u00f6":"Latin Small Letter O With Diaeresis"}')
    const order = [...canonicalize(o).matchAll(/:"([^"]+)"/g)].map(m => m[1]) // JS objects put "1" first, so read the string
    expect(order).toEqual(['Carriage Return', 'One', 'Control', 'Latin Small Letter O With Diaeresis', 'Euro Sign', 'Emoji: Grinning Face', 'Hebrew Letter Dalet With Dagesh'])
  })
  const table: [string, string][] = [
    ['0000000000000000', '0'], ['8000000000000000', '0'], ['0000000000000001', '5e-324'], ['8000000000000001', '-5e-324'],
    ['7fefffffffffffff', '1.7976931348623157e+308'], ['ffefffffffffffff', '-1.7976931348623157e+308'], ['4340000000000000', '9007199254740992'],
    ['c340000000000000', '-9007199254740992'], ['4430000000000000', '295147905179352830000'], ['44b52d02c7e14af5', '9.999999999999997e+22'],
    ['44b52d02c7e14af6', '1e+23'], ['44b52d02c7e14af7', '1.0000000000000001e+23'], ['444b1ae4d6e2ef4e', '999999999999999700000'],
    ['444b1ae4d6e2ef4f', '999999999999999900000'], ['444b1ae4d6e2ef50', '1e+21'], ['3eb0c6f7a0b5ed8c', '9.999999999999997e-7'],
    ['3eb0c6f7a0b5ed8d', '0.000001'], ['41b3de4355555553', '333333333.3333332'], ['41b3de4355555554', '333333333.33333325'],
    ['41b3de4355555555', '333333333.3333333'], ['41b3de4355555556', '333333333.3333334'], ['41b3de4355555557', '333333333.33333343'],
    ['becbf647612f3696', '-0.0000033333333333333333'], ['43143ff3c1cb0959', '1424953923781206.2'],
  ]
  it.each(table)('Appendix B number %s -> %s', (hex, out) => { expect(canonicalize(f64(hex))).toBe(out) })
  it('Appendix B: NaN and Infinity are rejected', () => {
    expect(() => canonicalize(f64('7fffffffffffffff'))).toThrow(); expect(() => canonicalize(f64('7ff0000000000000'))).toThrow()
  })
  it('§3.2.4 UTF-8 output', () => { expect([...canonicalBytes({ a: '€' })]).toEqual([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xe2, 0x82, 0xac, 0x22, 0x7d]) })
})

describe('canonicalization properties', () => {
  it('reordered properties give identical output', () => {
    expect(canonicalize({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: 'z' } })).toBe(canonicalize({ a: { c: 'z', d: [1, { x: 1, y: 2 }] }, b: 1 }))
  })
  it('array order matters', () => { expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1])) })
  it('invisible Unicode is preserved, never normalised', () => {
    expect(canonicalize('a\u{E0041}')).not.toBe(canonicalize('a'))
    expect(canonicalize('e\u0301')).not.toBe(canonicalize('\u00e9'))
    expect(canonicalize('\u200B')).toBe('"\u200B"')
  })
  it('lone surrogates and controls are escaped like ECMAScript', () => { expect(canonicalize('\ud800\u0001')).toBe('"\\ud800\\u0001"') })
  it('undefined members are dropped, functions rejected', () => {
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}')
    expect(() => canonicalize({ f: () => 1 })).toThrow()
  })
})
