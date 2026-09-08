// Clockwise control points of a normalized ellipse, starting at its rear.
const POINTS = [
  [0, -1], [.5, -.8660254], [.8660254, -.5], [1, 0],
  [.8660254, .5], [.5, .8660254], [0, 1], [-.5, .8660254],
  [-.8660254, .5], [-1, 0], [-.8660254, -.5], [-.5, -.8660254],
] as const

export type MobileOrbitLayout = {
  radiusX: number; radiusY: number; logoWidth: number
  cardWidth: number; cardHeight: number; fit: number
}

const spline = (a: number, b: number, c: number, d: number, t: number) =>
  .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)

export function mobileOrbitPoint(angle: number, layout: MobileOrbitLayout) {
  const phase = ((angle % 360) + 360) % 360 / 30
  const index = Math.floor(phase)
  const t = phase - index
  const point = (offset: number) => POINTS[(index + offset + 12) % 12]
  const nx = spline(point(-1)[0], point(0)[0], point(1)[0], point(2)[0], t)
  const ny = spline(point(-1)[1], point(0)[1], point(1)[1], point(2)[1], t)
  const depth = Math.max(0, Math.min(1, (ny + 1) / 2))
  const scale = .7 + .3 * depth * depth * (3 - 2 * depth)
  let x = nx * layout.radiusX
  let y = ny * layout.radiusY
  // Minkowski-expanded logo bounds: the entire scaled card must clear the logo,
  // not just its center. Radial projection is continuous in either direction.
  const clearX = layout.logoWidth / 2 + layout.cardWidth * scale / 2 + 8
  const clearY = layout.logoWidth / 5 + layout.cardHeight * scale / 2 + 8
  const correction = Math.max(1, Math.min(clearX / Math.max(Math.abs(x), .001), clearY / Math.max(Math.abs(y), .001)))
  x *= correction
  y *= correction
  return { x: x * layout.fit, y: y * layout.fit, scale: scale * layout.fit, depth }
}

export function createMobileOrbitLayout(width: number, height: number, cardWidth: number, cardHeight: number): MobileOrbitLayout {
  const layout = { radiusX: Math.min(172, width * .37), radiusY: Math.min(96, height * .23), logoWidth: Math.min(180, width * .43), cardWidth, cardHeight, fit: 1 }
  let extentX = 0
  let extentY = 0
  // Reserve a little extra clearance between measured extrema and the stage.
  for (let angle = 0; angle < 360; angle += .5) {
    const p = mobileOrbitPoint(angle, layout)
    extentX = Math.max(extentX, Math.abs(p.x) + cardWidth * p.scale / 2)
    extentY = Math.max(extentY, Math.abs(p.y) + cardHeight * p.scale / 2)
  }
  layout.fit = Math.min(1, (width - 12) / (2 * extentX), (height - 12) / (2 * extentY))
  return layout
}
