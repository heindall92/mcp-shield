// Harness-Shield screenshots (ES, light and dark) from the production build: npm run build && npx vite preview --port 4173
// OUT overrides the folder (default /workspace/shots); U overrides the URL.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const U = process.env.U || 'http://localhost:4173/mcp-shield/', OUT = process.env.OUT || '/workspace/shots'
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const out = []
for (const theme of ['light', 'dark']) for (const [tag, w, h, mobile, full] of [['', 1440, 1000, false, false], ['-full', 1440, 1000, false, true], ['-mobile', 390, 844, true, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile })
  await ctx.addInitScript(t => { localStorage.setItem('mcps-theme', t); localStorage.setItem('mcps-lang', 'es'); localStorage.setItem('mcps-onboarded', '1'); localStorage.setItem('mcps-accent', 'azul') }, theme)
  const p = await ctx.newPage(); await p.goto(U + '#harness'); await p.waitForSelector('[data-testid=harness]')
  await p.click('[data-testid=hs-samples]'); await p.waitForSelector('[data-testid=hs-findings] article')
  await p.locator('[data-testid=hs-findings] article[data-rule=AHS-01] > button').first().click()
  await p.locator('[data-testid=hs-findings] article[data-rule=AHS-04] > button').first().click()
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(800); await p.evaluate(() => document.querySelectorAll('[data-testid=toast]').forEach(x => x.remove()))
  const path = `${OUT}/mcp-shield-harness-${theme}-es${tag}.png`
  await p.screenshot({ path, fullPage: full }); out.push(path); await ctx.close()
}
await b.close()
console.log(out.join('\n'))
