/**
 * Fig. "Zero telemetry": a sealed bench instrument.
 * A tray carries mcp.json into the housing, one rule cartridge per configuration rule on top read it one by one,
 * a findings card comes out of the right-hand slot, and the network port on the side is capped
 * and sealed with a wire: nothing can leave. The readout window shows the real number of
 * third-party requests the page has made (measured with the Resource Timing API).
 * Geometry only: pure functions that return SVG strings (no DOM, no user data).
 */
import * as k from './iso-kit'

export const WIDTH = 640
export const HEIGHT = 400
/** One cartridge per configuration rule (a test keeps it equal to ALL_RULES.length). */
export const RULES = 12

const PLATE: k.Plan = { x: -126, y: -80, w: 252, d: 160, r: 8 }
const PLATE_H = 10, FOOT_H = 5
const BOX: k.Plan = { x: -74, y: -50, w: 148, d: 96, r: 5 }
const BOX_H = 56
const TOP = BOX_H
const BAY: k.Plan = { x: -66, y: -30, w: 132, d: 34, r: 2 }
// Cartridges share the bay width whatever the number of rules (4 units of margin on each side)
const CART_GAP = 2.2, CART_H = 9
const CART_W = (BAY.w - 8 - (RULES - 1) * CART_GAP) / RULES
export const TRAY_OUT = 34 // how far the tray sticks out of the front face
export const CARD_OUT = 30 // how far the findings card comes out of the right slot

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOX.x, BOX.y, TOP + CART_H + 6], [BOX.x + BOX.w + CARD_OUT + 4, 0, 34], [-40, BOX.y + BOX.d + TRAY_OUT + 4, 18]],
  WIDTH, HEIGHT, { pad: 26, azimuth: 40 },
)
const at = (p: k.Point3) => k.iso(p, P)
const S = (paths: k.SolidPaths, style?: k.SolidStyle) => k.solidSvg(paths, style)
const L = (d: string, style?: k.LineStyle) => k.lineSvg(d, style)
const D = (pts: k.Flat[], style?: { size?: number; tone?: k.Tone }) => k.dotsSvg(pts, style)
const seg = (a: k.Point3, b: k.Point3) => k.segment(a, b, P)
const FRONT_Y = BOX.y + BOX.d // +y face (left on screen)
const SIDE_X = BOX.x + BOX.w // +x face (right on screen)

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`]
  for (const [x, y] of k.corners(PLATE, 20).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: 'lo' }))
    out.push(S(k.cylinder(x, y, 5.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: 'mid' }))
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: 'mid' }))
  const screws = k.corners(PLATE, 10)
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(''), { tone: 'lo' }))
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }))
  // label plate with three rule lines
  const label: k.Plan = { x: 62, y: PLATE.y + PLATE.d - 18, w: 40, d: 12, r: 1.2 }
  out.push(S(k.slabOf(label, 0, 0.8, P, 3, 0.3), { tone: 'mid', crease: 'none' }))
  out.push(D([at([label.x + 2, label.y + 2, 0.8]), at([label.x + label.w - 2, label.y + 2, 0.8]), at([label.x + 2, label.y + label.d - 2, 0.8]), at([label.x + label.w - 2, label.y + label.d - 2, 0.8])], { size: 0.4 }))
  return out.join('')
}

/** Network port on the +x face, near the back, with its cap and lead seal. */
function port() {
  const out: string[] = []
  const py = BOX.y + 5, pz = 10
  const housing: k.Plan = { x: SIDE_X, y: py, w: 4, d: 16, r: 1 }
  out.push(S(k.slabOf(housing, pz, 13, P, 3, 0.4), { tone: 'mid' }))
  const cap: k.Plan = { x: SIDE_X + 4, y: py - 1.5, w: 3.4, d: 19, r: 1.4 }
  out.push(S(k.slabOf(cap, pz - 1.5, 16, P, 4, 0.6), { tone: 'hi', crease: 'lo' }))
  out.push(L(seg([SIDE_X + 7.4, py + 2, pz + 12.5], [SIDE_X + 7.4, py + 15.5, pz + 12.5]), { tone: 'faint' }))
  out.push(D([at([SIDE_X + 7.4, py + 2.5, pz + 2]), at([SIDE_X + 7.4, py + 15, pz + 2])], { size: 0.5, tone: 'hi' }))
  // seal wire from the cap screw to a crimped lead seal hanging on the face
  const from = at([SIDE_X + 7.4, py + 15, pz + 2])
  const seal = at([SIDE_X + 1, py + 22, pz - 4])
  out.push(k.wireSvg(from, seal, { via: [at([SIDE_X + 6, py + 19, pz - 1])], tone: 'lo', size: 0.6 }))
  out.push(S(k.cylinder(SIDE_X + 1.6, py + 22, 1.8, pz - 6, 3, P, 16), { tone: 'mid' }))
  // the "no-network" glyph engraved on the cap: a ring with a bar
  out.push(L(k.sideRing([SIDE_X + 7.45, py + 8.75, pz + 6.5], 3, 'x', P, 18), { tone: 'lo' }))
  out.push(L(seg([SIDE_X + 7.45, py + 6.6, pz + 8.6], [SIDE_X + 7.45, py + 10.9, pz + 4.4]), { tone: 'lo' }))
  return out.join('')
}

function housing() {
  const out: string[] = []
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BOX, 2), 0, 2, P)}" style="filter:blur(5px)"/>`)
  out.push(S(k.slabOf(BOX, 0, 6, P, 6, 0.6), { tone: 'mid' })) // plinth
  out.push(S(k.slabOf(k.insetPlan(BOX, 1.5), 6, BOX_H - 6, P, 6, 1.2), { tone: 'mid', inner: k.sideSeam(k.insetPlan(BOX, 1.5), 30, P, 6) }))
  out.push(L(k.planOutline(k.insetPlan(BOX, 6), TOP, P, 6), { tone: 'lo' }))
  const tc = k.corners(BOX, 6)
  out.push(D(tc.map(([x, y]) => at([x, y, TOP])), { size: 0.5 }))
  // readout window on the front face (right half)
  const wx = 14, ww = 50, wz0 = 30, wz1 = 46
  const win = [at([wx, FRONT_Y, wz1]), at([wx + ww, FRONT_Y, wz1]), at([wx + ww, FRONT_Y, wz0]), at([wx, FRONT_Y, wz0])]
  out.push(`<path class="iso-shade" data-shade="0" d="${k.pathOf(win, true)}"/>`)
  out.push(L(k.pathOf(win, true), { tone: 'mid' }))
  out.push(L(seg([wx + 1.5, FRONT_Y, wz1 - 1.5], [wx + ww - 1.5, FRONT_Y, wz1 - 1.5]), { tone: 'faint' }))
  out.push(D([at([wx - 3, FRONT_Y, wz1 + 2]), at([wx + ww + 3, FRONT_Y, wz1 + 2]), at([wx - 3, FRONT_Y, wz0 - 2]), at([wx + ww + 3, FRONT_Y, wz0 - 2])], { size: 0.45 }))
  // name plate on the front face
  out.push(k.faceTextSvg(k.sideMatrix([wx, FRONT_Y], 24, P, 'left'), 'MCP-SHIELD · SEALED', { size: 3, tone: 'mid' }))
  // tray slot on the front face, left
  const sx0 = -62, sx1 = -18, sz = 13
  const slot = [at([sx0, FRONT_Y, sz + 4]), at([sx1, FRONT_Y, sz + 4]), at([sx1, FRONT_Y, sz - 1]), at([sx0, FRONT_Y, sz - 1])]
  out.push(`<path class="iso-shade" data-shade="0" d="${k.pathOf(slot, true)}"/>`, L(k.pathOf(slot, true), { tone: 'lo' }))
  // output slot on the side face
  const oy0 = 4, oy1 = 40, oz = 36
  const out2 = [at([SIDE_X, oy0, oz + 4]), at([SIDE_X, oy1, oz + 4]), at([SIDE_X, oy1, oz - 1]), at([SIDE_X, oy0, oz - 1])]
  out.push(`<path class="iso-shade" data-shade="0" d="${k.pathOf(out2, true)}"/>`, L(k.pathOf(out2, true), { tone: 'lo' }))
  out.push(port())
  // cartridge bay
  out.push(S(k.slabOf(BAY, TOP, 1.2, P, 3, 0.3), { tone: 'lo', crease: 'none' }))
  return out.join('')
}

export const cartX = (i: number) => BAY.x + 4 + i * (CART_W + CART_GAP)
/** One rule cartridge; `lit` marks the cartridge reading right now. */
export function cartridge(i: number, lit: boolean) {
  const plan: k.Plan = { x: cartX(i), y: BAY.y + 3, w: CART_W, d: BAY.d - 6, r: 1 }
  const z = TOP + 1.2
  return [
    S(k.slabOf(plan, z, CART_H, P, 3, 0.5), { tone: 'hi', crease: 'lo', lit }),
    L(k.planOutline(k.insetPlan(plan, 1.6), z + CART_H, P, 3), { tone: 'faint' }),
    L(k.lineOnTop([plan.x + 2.2, plan.y + plan.d - 5], [plan.x + plan.w - 2.2, plan.y + plan.d - 5], z + CART_H, P), { tone: lit ? 'lit' : 'lo' }),
    D([at([plan.x + plan.w / 2, plan.y + 4, z + CART_H])], { size: 0.45, tone: lit ? 'hi' : 'lo' }),
  ].join('')
}

/** The tray with the mcp.json sheet, drawn at rest fully out; moved with translateAlong. */
export function tray() {
  const plan: k.Plan = { x: -60, y: FRONT_Y, w: 40, d: TRAY_OUT, r: 1.4 }
  const z = 12
  const sheet: k.Plan = { x: plan.x + 4, y: FRONT_Y + 4, w: plan.w - 8, d: TRAY_OUT - 9, r: 0.6 }
  const out = [S(k.slabOf(plan, z, 2.2, P, 3, 0.3), { tone: 'mid' })]
  out.push(S(k.slabOf({ x: plan.x + plan.w / 2 - 5, y: plan.y + plan.d, w: 10, d: 2.4, r: 1 }, z, 3.2, P, 3), { tone: 'mid' })) // pull tab
  out.push(S(k.slabOf(sheet, z + 2.2, 0.5, P, 2), { tone: 'hi', lit: true, crease: 'none' }))
  for (let r = 0; r < 4; r++) out.push(L(k.lineOnTop([sheet.x + 3, sheet.y + 4 + r * 4], [sheet.x + 3 + [20, 14, 24, 10][r], sheet.y + 4 + r * 4], z + 2.7, P), { tone: 'faint', free: true }))
  out.push(k.faceTextSvg(k.topMatrix([sheet.x + 3, sheet.y + sheet.d - 3], z + 2.7, P, 'x'), 'mcp.json', { size: 3, tone: 'mid' }))
  return out.join('')
}

/** The findings card, drawn fully out of the side slot. */
export function card() {
  const plan: k.Plan = { x: SIDE_X, y: 7, w: CARD_OUT, d: 30, r: 1 }
  const z = 36
  const out = [S(k.slabOf(plan, z, 0.8, P, 2), { tone: 'hi', crease: 'none' })]
  const rows = [0, 1, 2]
  for (const r of rows) {
    const y = plan.y + 6 + r * 8
    out.push(D([at([SIDE_X + 5, y, z + 0.8])], { size: 0.8, tone: r === 0 ? 'hi' : 'mid' }))
    out.push(L(k.lineOnTop([SIDE_X + 9, y], [SIDE_X + 9 + [18, 13, 16][r], y], z + 0.8, P), { tone: r === 0 ? 'mid' : 'lo', free: true }))
  }
  return out.join('')
}

/** inset 0 = tray fully out, 1 = fully in. */
export const trayAt = (inset: number) => k.translateAlong(P, [0, -inset * TRAY_OUT, 0])
/** share 0 = card inside, 1 = fully out. */
export const cardAt = (share: number) => k.translateAlong(P, [-(1 - share) * CARD_OUT, 0, 0])

/** Readout window text position (in the window plane). */
export const readoutMatrix = k.sideMatrix([18, FRONT_Y], 41, P, 'left')

export const backArt = () => base() + housing()

/** Requests the page has made to any other origin, measured with the Resource Timing API. */
export function externalRequests(): number {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return 0
  return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    .filter(e => { try { return new URL(e.name, location.href).origin !== location.origin } catch { return false } }).length
}

