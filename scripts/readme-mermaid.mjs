// Renders every ```mermaid block of the given Markdown files with the same engine GitHub uses.
// A diagram that does not parse shows as an error box on GitHub, so this fails the build instead.
// Usage: node scripts/readme-mermaid.mjs [README.md ...]. CHROMIUM points to a local Chromium if Playwright's own is not installed.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['README.md']
const mermaidJs = createRequire(import.meta.url).resolve('mermaid/dist/mermaid.min.js')
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const p = await b.newPage()
await p.setContent('<!doctype html><html><body></body></html>')
await p.addScriptTag({ path: mermaidJs })
let failed = 0, total = 0
for (const file of files) {
  const md = readFileSync(file, 'utf8')
  for (const m of md.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)) {
    total++
    const line = md.slice(0, m.index).split('\n').length
    const err = await p.evaluate(async code => {
      // eslint-disable-next-line no-undef
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
      // eslint-disable-next-line no-undef
      try { await mermaid.render('d' + Math.random().toString(36).slice(2), code); return '' } catch (e) { return String(e?.message ?? e) }
    }, m[1])
    const kind = m[1].trim().split('\n')[0]
    if (err) { failed++; console.log(`✗ ${file}:${line} ${kind}\n${err}\n`) } else console.log(`✓ ${file}:${line} ${kind}`)
  }
}
await b.close()
console.log(`${total - failed}/${total} diagramas Mermaid renderizan`)
process.exit(failed || !total ? 1 : 0)
