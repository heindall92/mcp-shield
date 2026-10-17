// Regenerates the README screenshots from the production build (npm run build && npx vite preview --port 4173).
// U overrides the URL; CHROMIUM points to a local Chromium if Playwright's own is not installed.
import { chromium } from 'playwright'
const U = process.env.U || 'http://localhost:4173/mcp-shield/', OUT = 'docs/img'
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
async function shot(name, { theme = 'dark', lang = 'es', w = 1280, h = 860, full = false, mobile = false }, fn = async () => {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1.25, isMobile: mobile, hasTouch: mobile })
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('mcps-theme', t); localStorage.setItem('mcps-lang', l); localStorage.setItem('mcps-onboarded', '1'); localStorage.setItem('mcps-accent', 'azul') }, [theme, lang])
  const p = await ctx.newPage(); await p.goto(U); await p.waitForSelector('#main')
  await fn(p); await p.waitForTimeout(700)
  await p.evaluate(() => document.querySelectorAll('[data-testid=toast]').forEach(x => x.remove()))
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); await ctx.close()
}
const demo = id => async p => { await p.selectOption('[data-testid=demo-select]', id); await p.waitForSelector('[data-testid=findings] article'); await p.locator('[data-testid=findings] article button').first().click() }
await shot('auditor-dark', { full: true }, demo('dev-laptop'))
await shot('auditor-light', { theme: 'light', lang: 'en', full: true }, demo('dev-laptop'))
await shot('inicio-dark', {})
await shot('integridad-dark', {}, async p => { await p.goto(U + '#integridad'); await p.click('[data-testid=int-demo]'); for (const c of await p.locator('[data-testid=int-review] input[type=checkbox]').all()) await c.check(); await p.click('[data-testid=int-approve]'); await p.waitForSelector('[data-testid=int-events] li') })
await shot('simulador-dark', {}, async p => { await p.goto(U + '#simulador'); await p.click('[data-testid=run]'); await p.waitForSelector('[role=status]', { timeout: 6000 }) })
await shot('gobernanza-light', { theme: 'light' }, async p => { await p.goto(U + '#gobernanza') })
await shot('paleta-dark', {}, async p => { await p.keyboard.press('Control+k'); await p.keyboard.type('demo') })
await shot('ecosistema-light', { theme: 'light' }, async p => { await p.goto(U + '#ayuda/ecosistema'); await p.waitForSelector('[data-testid=eco] li') })
await shot('mobile-auditor-dark', { w: 390, h: 844, mobile: true }, demo('dev-laptop'))
await shot('mobile-menu-light', { theme: 'light', w: 390, h: 844, mobile: true }, async p => { await p.click('[data-testid=mobile-menu]') })
await b.close()
console.log('capturas en', OUT)
