import type { MCPShieldSnapshot } from './domain/types'
import type { Lang } from '../i18n/lang'
import { compare, type Comparison } from './diff/comparator'
import { evaluateIntegrity } from './rules/integrityRules'
import { fingerprint, type Fingerprint, type HmacKey } from './crypto/hashes'

export type Analysis = Comparison & ReturnType<typeof evaluateIntegrity> & { base?: Fingerprint; cand: Fingerprint; baseline?: MCPShieldSnapshot; candidate: MCPShieldSnapshot; firstBaseline: boolean }

/** Full offline pipeline: fingerprints, comparability, events, INT rules and the separate Configuration Risk. */
export async function analyze(candidate: MCPShieldSnapshot, baseline: MCPShieldSnapshot | undefined, key: HmacKey, lang: Lang, otherNames: string[] = []): Promise<Analysis> {
  const [cand, base] = await Promise.all([fingerprint(candidate, key), baseline ? fingerprint(baseline, key) : undefined])
  const cmp: Comparison = baseline ? compare(baseline, candidate) : { comparability: { comparable: candidate.capture.completeness !== 'invalid', blockers: candidate.capture.completeness === 'invalid' ? ['completeness'] : [], warnings: [] }, events: [], unconfirmedMissing: [] }
  if (baseline && base && cmp.comparability.comparable && base.root !== cand.root && !cmp.events.length) cmp.events.push({ type: 'INTEGRITY_MISMATCH', confidence: 'low', changes: [], notes: ['root-only'] })
  return { ...cmp, ...evaluateIntegrity(cmp.events, candidate, baseline, lang, otherNames), base, cand, baseline, candidate, firstBaseline: !baseline }
}
