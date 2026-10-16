// Mobile layout audit: every view at 320/360/390/430 px, light/dark, ES/EN.
// Fails on horizontal overflow or multi-word text squeezed into a < 80px column (word-per-line collapse).
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
const U = process.env.U || 'http://localhost:4173/mcp-shield/'
const shot = process.env.SHOTS !== '0'
const b = await chromium.launch(); const errs = [], ext = [], axe = []
const check = async (p, tag) => {
  const r = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = { overflow: document.documentElement.scrollWidth - vw, narrow: [] }
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
      if (!/\S\s+\S/.test(own)) continue
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.sr-only,[aria-hidden=true],svg')) continue
      const rc = el.getBoundingClientRect(); if (rc.width <= 2 || rc.height === 0) continue
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3
      if (rc.width < 80 && rc.height > lh * 2.2) out.narrow.push(`${el.tagName.toLowerCase()} ${Math.round(rc.width)}px "${own.slice(0, 30)}"`)
    }
    return out
  })
  if (r.overflow > 0) errs.push(`${tag}: horizontal overflow ${r.overflow}px`)
  r.narrow.slice(0, 3).forEach(n => errs.push(`${tag}: narrow text ${n}`))
}
for (const w of [320, 360, 390, 430]) for (const theme of ['dark', 'light']) for (const lang of ['es', 'en']) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addInitScript(([t, l]) => { if (!sessionStorage.getItem('i')) { localStorage.setItem('mcps-theme', t); localStorage.setItem('mcps-lang', l); sessionStorage.setItem('i', '1') } }, [theme, lang])
  const p = await ctx.newPage()
  p.on('request', r => { if (!r.url().startsWith(U)) ext.push(r.url()) }); p.on('pageerror', e => errs.push(String(e)))
  const tag = v => `${w}-${theme}-${lang}-${v}`
  const S = async (v, full = false) => { if (shot && w === 390 && lang === 'es') await p.screenshot({ path: `/workspace/shots/mcp-shield-v132-mobile-${theme}-${v}.png`, fullPage: full }) }
  const bar = async v => {
    const r = await p.evaluate(v => {
      const n = document.querySelector('[data-testid=bottom-bar]'); if (!n) return { err: 'missing' }
      const cs = getComputedStyle(n), rc = n.getBoundingClientRect(), out = []
      if (cs.position !== 'fixed' || Math.abs(rc.bottom - innerHeight) > 1 || rc.height === 0) out.push(`not fixed at bottom (${cs.position}, ${rc.bottom}/${innerHeight})`)
      const links = [...n.querySelectorAll('a')]
      if (links.length !== 5) out.push('expected 5 tabs')
      for (const a of links) {
        const b = a.getBoundingClientRect(), l = a.querySelector('[data-label]'), lb = l.getBoundingClientRect()
        if (b.width < 44 || b.height < 44) out.push(`small target ${a.textContent} ${Math.round(b.width)}x${Math.round(b.height)}`)
        if (l.scrollWidth > l.clientWidth + 0.5 || lb.left < b.left - 0.5 || lb.right > b.right + 0.5) out.push(`label clipped ${l.textContent}`)
      }
      const cur = n.querySelectorAll('[aria-current=page]'); if (cur.length !== 1 || cur[0].getAttribute('href') !== '#' + v) out.push('aria-current wrong')
      return { err: out.join('; ') }
    }, v)
    if (r.err) errs.push(tag(`bottom bar (${v}): ${r.err}`))
  }
  const a11y = async v => { if (w !== 390) return; const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze(); r.violations.forEach(x => axe.push(`${tag(v)}: ${x.id} ${x.nodes[0]?.target}`)) }
  await p.goto(U); await p.waitForSelector('[data-testid=onboarding]'); await check(p, tag('home')); await S('home-top'); await a11y('home')
  const brandH = await p.evaluate(() => [...document.querySelectorAll('header a span')].find(s => s.textContent === 'MCP-Shield').getBoundingClientRect().height)
  if (brandH > 26) errs.push(tag('brand wraps'))
  await bar('auditor'); await S('bottom-bar')
  const seal = await p.evaluate(() => { const e = document.querySelector('header [data-testid=seal-mobile]'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth && r.top >= 0 })
  if (!seal) errs.push(tag('seal not visible in header'))
  if (shot && w === 390 && lang === 'es') await p.locator('header.sticky').screenshot({ path: `/workspace/shots/mcp-shield-v132-mobile-${theme}-header-seal.png` })
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(250); await check(p, tag('footer')); await S('footer-end')
  const end = await p.evaluate(() => { const f = [...document.querySelectorAll('footer *')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0); return { f, bar: document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect().top } })
  if (end.f > end.bar + 0.5) errs.push(tag(`footer covered by bar ${Math.round(end.f)} > ${Math.round(end.bar)}`))
  await p.evaluate(() => scrollTo(0, 0))
  await p.click('[data-testid=mobile-menu]'); await p.waitForSelector('[role=menu]'); await p.waitForTimeout(300); await check(p, tag('menu')); await a11y('menu')
  await p.keyboard.press('Escape')
  await p.click('[data-testid=search-pill]'); await p.waitForSelector('dialog[open]'); await p.waitForTimeout(350); await check(p, tag('palette')); await a11y('palette'); await p.keyboard.press('Escape')
  await p.selectOption('[data-testid=demo-select]', { index: 1 }); await p.waitForSelector('[data-testid=findings] article'); await p.waitForTimeout(300); await check(p, tag('auditor')); await a11y('auditor')
  await p.locator('[data-testid=bottom-bar] a[href="#gobernanza"]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  if (!(await p.evaluate(() => location.hash === '#gobernanza'))) errs.push(tag('bottom bar keyboard nav failed'))
  for (const v of ['integridad', 'simulador', 'gobernanza', 'ayuda']) {
    await p.goto(U + '#' + v); await p.reload(); await p.waitForTimeout(400)
    if (v === 'integridad') {
      await p.click('[data-testid=int-demo]'); await p.waitForSelector('[data-testid=int-review] input[type=checkbox]')
      for (const c of await p.locator('[data-testid=int-review] input[type=checkbox]').all()) await c.check()
      await p.click('[data-testid=int-approve]'); await p.waitForSelector('[data-testid=int-events] li'); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600)
      await S('integridad'); await S('integridad-full', true)
    }
    await bar(v)
    if (v === 'simulador') { await p.click('[data-testid=run]'); await p.waitForTimeout(600) }
    await check(p, tag(v)); await a11y(v)
  }
  await p.goto(U + '#ayuda'); await p.reload(); await p.waitForTimeout(200)
  await p.click('[data-testid=mobile-menu]'); await p.locator('[role=menu] [role=menuitem]').last().click(); await p.waitForSelector('dialog[open]'); await p.waitForTimeout(350); await check(p, tag('zero-modal')); await a11y('zero-modal')
  await ctx.close()
}
console.log('external', ext, 'errors', errs.length, errs.slice(0, 60), 'axe', axe)
if (ext.length || errs.length || axe.length) process.exitCode = 1
await b.close()
