import { cn } from '@/lib/utils'

/**
 * Linhas orgânicas discretas da identidade EME.
 * Usadas como textura de fundo — nunca como decoração isolada.
 */
export function OrganicLines({
  className,
  count = 6,
  animate = true,
}: {
  className?: string
  count?: number
  animate?: boolean
}) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <svg
        viewBox="0 0 800 600"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        className={cn('h-full w-full', animate && 'animate-drift')}
      >
        {Array.from({ length: count }).map((_, i) => (
          <path
            key={i}
            d={`M 840 ${20 + i * 74} C 600 ${-10 + i * 74}, 520 ${190 + i * 48}, 300 ${175 + i * 66} S -60 ${360 + i * 34}, -120 ${430 + i * 34}`}
            stroke="var(--color-eme-100)"
            strokeWidth="1.4"
            fill="none"
          />
        ))}
      </svg>
    </div>
  )
}
