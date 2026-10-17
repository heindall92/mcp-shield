#!/usr/bin/env python3
"""Generates the README header and footer (docs/assets/banner.svg, docs/assets/footer.svg).

The text is converted to paths with the app's own fonts (Inter and JetBrains Mono from @fontsource),
so GitHub shows the same lettering on every system: an SVG inside <img> cannot load web fonts.
Visual: a living shield (outline drawn, check, shield-shaped echoes, inner scan, packets neutralised at
the edge) with Emil Kowalski's curves; under prefers-reduced-motion it rests in its final state. Requires: pip install fonttools brotli. Usage: python3 scripts/readme-banner.py
"""
import math
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'node_modules/@fontsource-variable'
OUT = ROOT / 'docs/assets'

# Palette of the app (palette.js): canvas, surfaces, electric blue (accent "azul") and the danger/warn/ok signals.
BG, SURFACE, LINE = '#07090d', '#0d121b', '#1a2230'
BLUE, BLUE_HI, BLUE_DEEP = '#3d6bff', '#9dbdff', '#1a4fe0'
TEXT, MUTED, FAINT = '#f4f6fb', '#9aa4b2', '#5b6577'
RED, AMBER, GREEN = '#ff6b6b', '#ffb020', '#4fc98a'

_cache: dict = {}


def font(name: str, weight: int) -> TTFont:
    key = (name, weight)
    if key not in _cache:
        f = TTFont(FONTS / name)
        _cache[key] = instancer.instantiateVariableFont(f, {'wght': weight}) if 'fvar' in f else f
    return _cache[key]


def text(s: str, x: float, y: float, size: float, fill: str, *, f: str = 'inter/files/inter-latin-wght-normal.woff2',
         weight: int = 400, track: float = 0, anchor: str = 'start', extra: str = '') -> str:
    """Path for s with its baseline at y. track is letter spacing in em; anchor start|middle|end."""
    tt = font(f, weight)
    gs, cmap, hmtx = tt.getGlyphSet(), tt.getBestCmap(), tt['hmtx']
    scale = size / tt['head'].unitsPerEm
    names = [cmap.get(ord(c), '.notdef') for c in s]
    width = sum(hmtx[n][0] for n in names) * scale + track * size * (len(s) - 1)
    pen_x = x - (width if anchor == 'end' else width / 2 if anchor == 'middle' else 0)
    d = []
    for n in names:
        pen = SVGPathPen(gs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.'))
        gs[n].draw(TransformPen(pen, (scale, 0, 0, -scale, pen_x, y)))
        if pen.getCommands():
            d.append(pen.getCommands())
        pen_x += hmtx[n][0] * scale + track * size
    return f'<path fill="{fill}" {extra}d="{" ".join(d)}"/>'


MONO = 'jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'
# Lucide "shield-check" (ISC licence), 24×24 grid.
SHIELD = ('M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 '
          '6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z')
CHECK = 'm9 12 2 2 4-4'


def banner() -> str:
    """Living shield: the outline draws itself, the check lands, shield-shaped echoes breathe out, a beam scans
    inside and incoming packets are neutralised at the edge. Curves from Emil Kowalski's guide; with
    prefers-reduced-motion everything rests in its final state."""
    W, H = 1280, 340
    cx, cy, s = 1012, 170, 10.4                      # shield centre and scale on the 24×24 Lucide grid
    sh = f'translate({cx - 12 * s:.1f} {cy - 12 * s:.1f}) scale({s})'
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" '
           f'aria-labelledby="t d"><title id="t">MCP-Shield</title>'
           f'<desc id="d">Un escudo azul que se dibuja, escanea y neutraliza paquetes entrantes: MCP-Shield audita la '
           f'configuración MCP en el navegador y sin enviar nada.</desc>']
    out.append(f'''<defs>
  <clipPath id="card"><rect width="{W}" height="{H}" rx="28"/></clipPath>
  <clipPath id="inside"><path transform="{sh}" d="{SHIELD}"/></clipPath>
  <radialGradient id="glow" cx="{cx / W:.3f}" cy="{cy / H:.3f}" r="0.42"><stop offset="0" stop-color="{BLUE}" stop-opacity=".34"/><stop offset=".5" stop-color="{BLUE}" stop-opacity=".08"/><stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></radialGradient>
  <linearGradient id="word" x1="0" x2="1"><stop offset="0" stop-color="{BLUE_HI}"/><stop offset="1" stop-color="{BLUE}"/></linearGradient>
  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BLUE}" stop-opacity=".30"/><stop offset="1" stop-color="{BLUE_DEEP}" stop-opacity=".06"/></linearGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BLUE}" stop-opacity="0"/><stop offset=".8" stop-color="{BLUE}" stop-opacity=".28"/><stop offset="1" stop-color="{BLUE_HI}"/></linearGradient>
  <linearGradient id="lane" x1="1" x2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity=".07"/></linearGradient>
  <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ffffff" fill-opacity=".05"/></pattern>
</defs>
<style>
  /* Emil Kowalski: ease-out to enter, ease-in-out to move on screen, nothing from scale(0). */
  .draw {{ stroke-dasharray: 1.05 1.05; stroke-dashoffset: 0; animation: draw 1.3s cubic-bezier(.77,0,.175,1) .15s backwards; }}
  .check {{ stroke-dasharray: 1.05 1.05; stroke-dashoffset: 0; animation: draw .5s cubic-bezier(.23,1,.32,1) 1.25s backwards; }}
  .fill {{ animation: fade .6s cubic-bezier(.23,1,.32,1) 1s backwards; }}
  .seal {{ transform-box: fill-box; transform-origin: center; animation: settle .7s cubic-bezier(.23,1,.32,1) .1s backwards; }}
  @keyframes draw {{ from {{ stroke-dashoffset: 1.05; }} }}
  @keyframes fade {{ from {{ opacity: 0; }} }}
  @keyframes settle {{ from {{ opacity: 0; transform: scale(.96); }} }}
  .echo {{ transform-box: fill-box; transform-origin: center; opacity: 0; animation: echo 3.6s cubic-bezier(.23,1,.32,1) infinite; }}
  .e0 {{ animation-delay: 1.6s; }} .e1 {{ animation-delay: 2.8s; }} .e2 {{ animation-delay: 4s; }}
  @keyframes echo {{ 0% {{ opacity: .8; transform: scale(1); }} 75%, 100% {{ opacity: 0; transform: scale(1.38); }} }}
  .scan {{ animation: scan 3.2s cubic-bezier(.77,0,.175,1) 1.6s infinite alternate backwards; }}
  @keyframes scan {{ from {{ transform: translateY(0); opacity: 1; }} to {{ transform: translateY({20 * s - 40:.0f}px); }} }}
  .pkt {{ opacity: 0; animation: pkt 3s linear infinite; }}
  .cool {{ opacity: 0; animation: cool 3s linear infinite; }}
  @keyframes cool {{ 0%, 52% {{ opacity: 0; }} 61%, 100% {{ opacity: 1; }} }}
  .hit {{ opacity: 0; transform-box: fill-box; transform-origin: center; animation: hit 3s cubic-bezier(.23,1,.32,1) infinite; }}
  .d1 {{ animation-delay: 2s; }} .d2 {{ animation-delay: 3s; }} .d3 {{ animation-delay: 4s; }}
  @keyframes pkt {{ 0% {{ opacity: 0; transform: translateX(0); }} 12% {{ opacity: 1; }} 61% {{ opacity: 1; transform: translateX(var(--run)); }} 68%, 100% {{ opacity: 0; transform: translateX(var(--run)); }} }}
  @keyframes hit {{ 0%, 60% {{ opacity: 0; transform: scale(.6); }} 64% {{ opacity: 1; transform: scale(1); }} 90%, 100% {{ opacity: 0; transform: scale(1.6); }} }}
  .rise {{ animation: rise .5s cubic-bezier(.23,1,.32,1) backwards; }}
  .r1 {{ animation-delay: .05s; }} .r2 {{ animation-delay: .09s; }} .r3 {{ animation-delay: .13s; }} .r4 {{ animation-delay: .17s; }}
  @keyframes rise {{ from {{ opacity: 0; transform: translateY(6px); }} }}
  .blink {{ animation: blink 1.1s steps(1) infinite; }}
  @keyframes blink {{ 50% {{ opacity: 0; }} }}
  @media (prefers-reduced-motion: reduce) {{
    .draw, .check, .fill, .seal, .scan, .rise, .blink {{ animation: none; }}
    .echo, .pkt, .hit, .cool {{ animation: none; opacity: 0; }}
  }}
</style>''')
    out.append(f'<g clip-path="url(#card)"><rect width="{W}" height="{H}" fill="{BG}"/><rect width="{W}" height="{H}" fill="url(#dots)"/>'
               f'<rect width="{W}" height="{H}" fill="url(#glow)"/><rect x="0" y="{H - 3}" width="{W}" height="3" fill="{BLUE}"/>')

    # Incoming packets on three lanes from the right edge; each one is neutralised at the shield's edge.
    edge = cx + 8 * s + 14
    lanes = [(cy - 62, RED, 'd1'), (cy + 6, AMBER, 'd2'), (cy + 70, RED, 'd3')]
    for ly, col, d in lanes:
        out.append(f'<rect x="{edge}" y="{ly - .5}" width="{W - edge}" height="1" fill="url(#lane)"/>')
        run = -(W + 10 - edge)
        out.append(f'<g class="pkt {d}" style="--run:{run:.0f}px"><rect x="{W + 10}" y="{ly - 3}" width="22" height="6" rx="3" fill="{col}"/>'
                   f'<rect class="cool {d}" x="{W + 10}" y="{ly - 3}" width="22" height="6" rx="3" fill="{BLUE_HI}"/></g>')
        sparks = ' '.join(f'M{edge + 7 * math.cos(t):.1f} {ly + 7 * math.sin(t):.1f}L{edge + 15 * math.cos(t):.1f} {ly + 15 * math.sin(t):.1f}'
                          for t in [math.radians(k) for k in (-150, -90, -30, 30, 90, 150, 180)])
        out.append(f'<g class="hit {d}"><path d="{sparks}" stroke="{BLUE_HI}" stroke-width="2" stroke-linecap="round" fill="none"/>'
                   f'<circle cx="{edge}" cy="{ly}" r="3.5" fill="{BLUE_HI}"/></g>')

    # Shield: echoes, body, inner scan, outline that draws itself and the check.
    for e in ('e0', 'e1', 'e2'):
        out.append(f'<g class="echo {e}"><path transform="{sh}" d="{SHIELD}" fill="none" stroke="{BLUE_HI}" stroke-width="{1.6 / s:.3f}" '
                   f'stroke-opacity=".9"/></g>')
    out.append(f'<g class="seal">')
    out.append(f'<path class="fill" transform="{sh}" d="{SHIELD}" fill="url(#fill)"/>')
    out.append(f'<g clip-path="url(#inside)"><g class="scan"><rect x="{cx - 9 * s}" y="{cy - 12 * s - 30}" width="{18 * s}" height="40" fill="url(#beam)"/>'
               f'<rect x="{cx - 9 * s}" y="{cy - 12 * s + 9}" width="{18 * s}" height="1.5" fill="{BLUE_HI}" fill-opacity=".9"/></g></g>')
    out.append(f'<path class="draw" pathLength="1" transform="{sh}" d="{SHIELD}" fill="none" stroke="{BLUE}" stroke-width="{3.2 / s:.3f}" '
               f'stroke-linecap="round" stroke-linejoin="round"/>')
    out.append(f'<path class="check" pathLength="1" transform="{sh}" d="{CHECK}" fill="none" stroke="{BLUE_HI}" stroke-width="{6 / s:.3f}" '
               f'stroke-linecap="round" stroke-linejoin="round"/>')
    out.append('</g></g>')
    out.append(f'<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="27.5" fill="none" stroke="#ffffff" stroke-opacity=".08"/>')

    # Left: command, wordmark, claim and facts, rising in 40 ms steps.
    x = 72
    out.append(f'<g class="rise">{text("$ mcp-shield audit ~/.cursor/mcp.json", x, 92, 17, BLUE_HI, f=MONO, weight=500)}'
               f'<rect class="blink" x="{x + 392}" y="77" width="9" height="19" rx="1.5" fill="{BLUE_HI}"/></g>')
    tt = font('inter/files/inter-latin-wght-normal.woff2', 700)
    cmap, hmtx, upm = tt.getBestCmap(), tt['hmtx'], tt['head'].unitsPerEm
    adv = sum(hmtx[cmap[ord(c)]][0] for c in 'MCP-') * 92 / upm - 0.035 * 92 * 4
    out.append(f'<g class="rise r1">{text("MCP-", x - 3, 188, 92, TEXT, weight=700, track=-0.035)}'
               f'{text("Shield", x - 3 + adv, 188, 92, "url(#word)", weight=700, track=-0.035)}</g>')
    out.append(f'<g class="rise r2">{text("Auditor de configuraciones del Model Context Protocol", x, 232, 22, MUTED, weight=450)}</g>')
    facts = ['12 reglas', '8 de integridad', 'cero egress', 'ES · EN']
    fx, chips = x, []
    tt_m = font(MONO, 500)
    for i, fact in enumerate(facts):
        w = sum(tt_m['hmtx'][tt_m.getBestCmap()[ord(c)]][0] for c in fact.upper()) * 13.5 / tt_m['head'].unitsPerEm + 0.04 * 13.5 * (len(fact) - 1)
        chips.append(f'<rect x="{fx:.1f}" y="262" width="{w + 26:.1f}" height="30" rx="15" fill="{SURFACE}" stroke="{LINE}"/>')
        chips.append(text(fact.upper(), fx + 13, 282, 13.5, BLUE_HI if i == 0 else MUTED, f=MONO, weight=500, track=0.04))
        fx += w + 26 + 10
    out.append(f'<g class="rise r3">{"".join(chips)}</g>')
    out.append('</svg>')
    return '\n'.join(out) + '\n'


def footer() -> str:
    W, H = 1280, 96
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t">'
           f'<title id="t">MCP-Shield · local-first · cero egress · MIT</title>',
           f'<defs><linearGradient id="rule" x1="0" x2="1"><stop offset="0" stop-color="{BLUE}" stop-opacity="0"/><stop offset=".5" stop-color="{BLUE}"/><stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></linearGradient></defs>',
           f'<rect x="0" y="47" width="{W}" height="2" fill="url(#rule)"/>',
           f'<rect x="{W / 2 - 190}" y="22" width="380" height="52" rx="26" fill="{BG}" stroke="{LINE}"/>']
    s = 1.35
    out.append(f'<g transform="translate({W / 2 - 172} {48 - 12 * s}) scale({s})" fill="none" stroke="{BLUE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
               f'<path d="{SHIELD}" fill="{BLUE}" fill-opacity=".14"/><path d="{CHECK}" stroke="{BLUE_HI}"/></g>')
    out.append(text('LOCAL-FIRST · CERO EGRESS · MIT', W / 2 + 18, 53.5, 14, MUTED, f=MONO, weight=500, track=0.06, anchor='middle'))
    out.append('</svg>')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, svg in (('banner.svg', banner()), ('footer.svg', footer())):
        (OUT / name).write_text(svg, encoding='utf-8')
        print(f'docs/assets/{name}: {len(svg) // 1024} KiB')
