import { GraduationCap, Landmark, MapPin, ShoppingCart } from 'lucide-react'
import type { PropertyDetail } from '@/lib/marketplace/property-detail'

const routineIcons = {
  center: Landmark,
  market: ShoppingCart,
  school: GraduationCap,
} as const

export function PropertyLocation({
  city,
  state,
  routine,
}: {
  city: string
  state: string
  routine: PropertyDetail['routine']
}) {
  return (
    <div>
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
        Localização e rotina
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
        {/* Mapa demonstrativo — sem serviços externos, localização aproximada */}
        <div className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted shadow-[var(--shadow-soft)]">
          <svg
            viewBox="0 0 400 320"
            preserveAspectRatio="xMidYMid slice"
            className="h-full min-h-[240px] w-full"
            aria-hidden="true"
          >
            <rect width="400" height="320" fill="var(--color-muted)" />
            <path d="M-20 50 Q 90 10 170 60 T 340 50 L 360 -20 -40 -20 Z" fill="var(--color-eme-50)" opacity="0.7" />
            <ellipse cx="70" cy="250" rx="90" ry="70" fill="var(--color-eme-50)" opacity="0.6" />
            <ellipse cx="340" cy="270" rx="80" ry="80" fill="var(--color-eme-50)" opacity="0.55" />
            <path
              d="M-20 160 C 120 130 180 210 420 170"
              stroke="var(--color-eme-100)"
              strokeWidth="12"
              fill="none"
              opacity="0.6"
              strokeLinecap="round"
            />
            <g stroke="var(--color-border)" strokeWidth="2" opacity="0.9">
              <line x1="0" y1="90" x2="400" y2="110" />
              <line x1="0" y1="200" x2="400" y2="220" />
              <line x1="120" y1="0" x2="140" y2="320" />
              <line x1="260" y1="0" x2="275" y2="320" />
            </g>
          </svg>

          {/* Zona aproximada (raio) em vez de ponto exato */}
          <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <span className="h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-background" />
          </div>

          <div className="glass-strong absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)]">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {city} · {state}
          </div>
        </div>

        {/* Rotina */}
        <ul className="flex flex-col gap-3">
          {routine.map((item) => {
            const Icon = routineIcons[item.icon]
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-[var(--shadow-soft)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-eme-50 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.time} · Aproximadamente</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        A localização exata é compartilhada pelo profissional responsável.
      </p>
    </div>
  )
}
