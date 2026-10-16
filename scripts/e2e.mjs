import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
const U = process.env.U || 'http://localhost:4173/mcp-shield/'
const REAL = '{ "mcpServers": { "fs": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/yoandy"] }, "gh": { "command": "npx", "args": ["-y","@modelcontextprotocol/server-github"], "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_FAKEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } } } }'
const b = await chromium.launch(); const ext = [], errs = [], axe = []
const shot = process.env.SHOTS !== '0'
for (const theme of ['dark', 'light']) for (const lang of ['es', 'en']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })
  await ctx.addInitScript(([t, l]) => { if (!sessionStorage.getItem('i')) { localStorage.setItem('mcps-theme', t); localStorage.setItem('mcps-lang', l); sessionStorage.setItem('i', '1') } }, [theme, lang])
  const p = await ctx.newPage()
  p.on('request', r => { if (!r.url().startsWith(U)) ext.push(r.url()) })
  p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)))
  const n = v => `/workspace/shots/mcp-shield-v12-${theme}-${lang}-${v}.png`
  const a11y = async tag => { const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze(); r.violations.forEach(v => axe.push(`${theme}-${lang}-${tag}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)) }
  await p.goto(U); await p.waitForSelector('[data-testid=onboarding]')
  if (shot) await p.screenshot({ path: n('onboarding') }); await a11y('start')
  // palette via keyboard
  await p.keyboard.press('Control+k'); await p.waitForSelector('dialog[open] [data-testid=palette-input]')
  await p.keyboard.type('poisoning'); await p.waitForTimeout(150)
  if (shot) await p.screenshot({ path: n('palette') }); await a11y('palette')
  await p.keyboard.press('Enter'); await p.waitForSelector('[data-testid=findings] article'); await p.waitForSelector('[data-testid=toast]')
  if (shot && theme === 'dark') await p.screenshot({ path: n('toast') })
  await p.fill('[data-testid=editor]', REAL); await p.waitForTimeout(250)
  await p.locator('[data-testid=findings] article button').first().click()
  await a11y('audit')
  if (shot) { await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: n('print'), fullPage: true }); await p.emulateMedia({ media: 'screen' }) }
  const printTxt = await p.evaluate(() => { const ed = document.querySelector('[data-testid=editor-pane]'); return getComputedStyle(ed).display })
  if (printTxt !== 'flex') errs.push('editor hidden on screen?')
  await p.keyboard.press('Escape'); await p.locator('body').click({ position: { x: 5, y: 700 } })
  await p.keyboard.press('?'); await p.waitForSelector('#h-atajos')
  if (shot) await p.screenshot({ path: n('help'), fullPage: true }); await a11y('help')
  await p.fill('#help-q', 'zzzzqqq'); await p.waitForSelector('text=' + (lang === 'es' ? 'Nada coincide' : 'Nothing matches'))
  await p.fill('#help-q', ''); await p.locator('body').click({ position: { x: 5, y: 5 } })
  await p.goto(U + '#ayuda/legal'); await p.waitForSelector('#h-legal'); await p.waitForTimeout(200)
  if (shot) await p.screenshot({ path: n('legal') })
  // v1.2: zero-telemetry figure, real readout, fonts
  await p.goto(U + '#ayuda/telemetria'); await p.waitForSelector('[data-testid=zero-figure] svg'); await p.waitForTimeout(400)
  const ro = await p.textContent('[data-testid=zero-figure] [data-corner=readout]'); if (!/^0 /.test(ro)) errs.push('readout not 0: ' + ro)
  if (shot) await p.locator('[data-testid=zero-figure]').screenshot({ path: n('anatomy') }); await a11y('figure')
  const fonts = await p.evaluate(async () => { await document.fonts.ready; return [document.fonts.check('16px "Inter Variable"'), document.fonts.check('16px "JetBrains Mono Variable"'), getComputedStyle(document.body).fontFamily] })
  if (!fonts[0] || !fonts[1]) errs.push('fonts not loaded ' + JSON.stringify(fonts))
  if (shot && lang === 'en') await p.screenshot({ path: n('typography') })
  // v1.2: ASCII smuggling sample
  await p.goto(U + '#auditor'); await p.locator('body').click({ position: { x: 5, y: 5 } })
  await p.selectOption('[data-testid=demo-select]', 'smuggling'); await p.waitForSelector('[data-testid=findings] article:has-text("MCPS-TP-003")')
  await p.locator('[data-testid=findings] article:has-text("MCPS-TP-003") button').first().click(); await p.waitForTimeout(250)
  if (shot) await p.screenshot({ path: n('smuggling') }); await a11y('smuggling')
  await p.goto(U + '#gobernanza'); await p.waitForTimeout(300); await a11y('governance')
  await p.locator('body').click({ position: { x: 5, y: 5 } })
  await p.keyboard.press('2'); await p.waitForSelector('[data-testid=demo-badge]'); await a11y('simulator')
  await p.click('[data-testid=run]'); await p.waitForSelector('[role=status]', { timeout: 5000 }); await a11y('simulator-done')
  const before = await p.evaluate(() => document.documentElement.className)
  await p.keyboard.press('t'); const after = await p.evaluate(() => document.documentElement.className)
  if (before === after) errs.push('theme toggle key failed')
  const store = await p.evaluate(() => JSON.stringify(localStorage)); if (/FAKE/.test(store)) errs.push('secret in storage')
  console.log(theme, lang, 'ok', JSON.stringify(Object.keys(JSON.parse(store))))
  await ctx.close()
}
console.log('external', ext, 'errors', errs, 'axe', axe)
await b.close()
