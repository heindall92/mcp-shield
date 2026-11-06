import type { HarnessFile } from './types'
import fixtures from '../data/harness-samples.json'

/**
 * Demo bundle: deliberately malicious agent-harness files (fictitious hosts: *.example.invalid and TEST-NET
 * 203.0.113.0/24; no real credentials). They are analysed as text and never executed.
 *
 * The payloads live in src/data/harness-samples.json as data, not as source code: test payloads are inputs
 * for the scanner, and keeping them out of .ts files stops code scanners from reading them as this project's
 * own behaviour. The JSON is ASCII-only: every invisible or non-ASCII character is a \uXXXX escape, so the
 * file stays reviewable. tests/harness-v170.test.ts checks that it loads and that every rule still fires.
 */
export const HARNESS_SAMPLES: HarnessFile[] = (fixtures as { name: string; lines: string[] }[])
  .map(f => ({ name: f.name, text: f.lines.join('\n') }))
