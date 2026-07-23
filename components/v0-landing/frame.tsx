import type { ReactNode } from 'react'

/**
 * A frameless "screen plate" used to present real product screens.
 *
 * There is no fake browser chrome, no window dots, no card, no visible border —
 * only discreetly rounded corners, an extremely soft ambient shadow and a
 * whisper of ambient glow so the interface reads as a premium product render
 * (Apple / Linear / Vercel) that breathes in the layout instead of sitting
 * inside a box.
 *
 * `label` and `live` are accepted for backwards compatibility and intentionally
 * ignored — the presentation is uniform and distraction-free.
 */
export function BrowserFrame({
  children,
  className = '',
  label: _label,
  live: _live,
}: {
  children: ReactNode
  className?: string
  label?: string
  live?: boolean
}) {
  return (
    <div className={`relative ${className}`}>
      {/* extremely soft ambient glow, kept behind the plate so nothing is clipped */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-foreground/[0.04] blur-2xl"
      />
      {/* the screen itself — discreet rounding, no ring, no card, feather-soft shadow */}
      <div className="overflow-hidden rounded-xl shadow-[0_40px_90px_-50px_rgba(15,23,42,0.28)] sm:rounded-2xl">
        {children}
      </div>
    </div>
  )
}
