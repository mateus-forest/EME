/** Continuous depth, not a time-based animation: reversing direction is symmetrical. */
export function orbitOpacity(depth: number) {
  const t = Math.max(0, Math.min(1, depth))
  return 0.16 + 0.84 * t * t * (3 - 2 * t)
}

export function orbitBrightness(depth: number) {
  const t = Math.max(0, Math.min(1, depth))
  const eased = t * t * (3 - 2 * t)
  return 0.78 + 0.22 * eased
}

export function nearestFrontAngle(current: number, baseAngle: number) {
  const difference = ((180 - baseAngle - current) % 360 + 540) % 360 - 180
  return current + difference
}
