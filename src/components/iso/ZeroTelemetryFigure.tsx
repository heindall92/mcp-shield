import { useEffect, useMemo, useRef, useState } from 'react'
import './iso.css'
import './iso-overrides.css'
import { figureSvg, faceTextSvg } from './iso-kit'
import { WIDTH, HEIGHT, RULES, backArt, cartridge, tray, card, trayAt, cardAt, readoutMatrix, externalRequests } from './zeroTelemetry'
import { usePrefs } from '../../i18n/prefs'

const CYCLE = 7000 // ms: tray in, eleven cartridges read, card out, tray back
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

export function ZeroTelemetryFigure() {
  const { t, theme } = usePrefs()
  const host = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(() => externalRequests())
  const svg = useMemo(() => figureSvg({
    width: WIDTH, height: HEIGHT, label: t.figAlt,
    body: [
      backArt(),
      `<g data-part="tray">${tray()}</g>`,
      `<g data-part="carts">${Array.from({ length: RULES }, (_, i) => `<g data-cart="${i}">${cartridge(i, false)}</g>`).join('')}</g>`,
      `<g data-part="card">${card()}</g>`,
      faceTextSvg(readoutMatrix, '0 REQ', { size: 7, tone: 'hi' }).replace('<text ', '<text data-part="readout" '),
    ],
  }), [t.figAlt])

  useEffect(() => {
    const id = window.setInterval(() => setCount(externalRequests()), 2000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const root = host.current
    if (!root) return
    const text = root.querySelector('[data-part="readout"]')
    if (text) text.textContent = `${count} REQ`
  }, [count, svg])

  useEffect(() => {
    const root = host.current
    if (!root) return
    const trayG = root.querySelector('[data-part="tray"]')!
    const cardG = root.querySelector('[data-part="card"]')!
    const carts = [...root.querySelectorAll('[data-cart] > .iso-solid')]
    const draw = (ms: number, pose?: { inset: number; lit: number; share: number }) => {
      const p = (ms % CYCLE) / CYCLE
      const inset = pose ? pose.inset : p < 0.14 ? ease(p / 0.14) : p < 0.86 ? 1 : 1 - ease((p - 0.86) / 0.14)
      trayG.setAttribute('transform', trayAt(inset))
      trayG.setAttribute('opacity', String(1 - 0.85 * Math.max(0, inset - 0.6) / 0.4))
      const read = (p - 0.16) / 0.5
      const lit = pose ? pose.lit : read >= 0 && read < 1 ? Math.floor(read * RULES) : -1
      carts.forEach((c, i) => (i === lit ? c.setAttribute('data-lit', '') : c.removeAttribute('data-lit')))
      const share = pose ? pose.share : p < 0.68 ? 0 : p < 0.8 ? ease((p - 0.68) / 0.12) : p < 0.94 ? 1 : 1 - ease((p - 0.94) / 0.06)
      cardG.setAttribute('transform', cardAt(share))
      cardG.setAttribute('opacity', String(Math.min(1, share * 4)))
    }
    // one still frame that tells the whole story: tray half in, a rule reading, findings out
    const still = () => draw(0, { inset: 0.45, lit: 6, share: 1 })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0, start = 0, visible = false
    const loop = (now: number) => { if (!start) start = now; draw(now - start); raf = requestAnimationFrame(loop) }
    const sync = () => {
      cancelAnimationFrame(raf); raf = 0
      if (visible && !reduce.matches) raf = requestAnimationFrame(loop)
      else still()
    }
    still()
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync() }, { threshold: 0.1 })
    io.observe(root)
    reduce.addEventListener('change', sync)
    return () => { io.disconnect(); reduce.removeEventListener('change', sync); cancelAnimationFrame(raf) }
  }, [svg])

  return (
    <figure className="iso iso-figure mcps-iso" data-theme={theme} data-testid="zero-figure">
      <div className="iso-plate">
        <div className="iso-plate-corners" aria-hidden="true">
          <span className="iso-plate-corner" data-corner="fig">{t.figNo}</span>
          <span className="iso-plate-corner" data-corner="title">{t.figTitle}</span>
          <span className="iso-plate-corner" data-corner="hint">connect-src 'none'</span>
          <span className="iso-plate-corner" data-corner="readout" data-readout="">{t.figReadout(count)}</span>
        </div>
        {/* Static SVG built by our own geometry module: no user data ever reaches this string. */}
        <div ref={host} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <figcaption className="iso-legend"><span className="iso-caption">{t.figCaption}</span></figcaption>
      <p className="sr-only" aria-live="polite">{t.figReadout(count)}</p>
    </figure>
  )
}
