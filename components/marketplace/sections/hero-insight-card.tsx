'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

const INSIGHTS = [
  {
    title: 'Muito compatível',
    description: 'Encontramos imóveis que combinam com o que você procura.',
  },
  {
    title: 'Boa localização',
    description: 'Opções próximas aos pontos que fazem sentido para você.',
  },
  {
    title: 'Dentro do perfil',
    description: 'Faixa de preço e características alinhadas à sua busca.',
  },
]

const ROTATION_INTERVAL_MS = 4_500

export function HeroInsightCard() {
  const [active, setActive] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reduced) return
    const interval = window.setInterval(() => {
      setActive((current) => (current + 1) % INSIGHTS.length)
    }, ROTATION_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [reduced])

  return (
    <aside
      aria-label="Insights de compatibilidade"
      style={{ borderWidth: '0.5px', borderColor: 'rgba(255,255,255,0.1)' }}
      className="absolute bottom-24 right-8 z-10 hidden w-[19rem] rounded-2xl border-solid bg-black/30 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.16)] backdrop-blur-xl lg:block"
    >
      <div className="relative min-h-[3.25rem]">
        {INSIGHTS.map((insight, index) => {
          const isActive = index === active
          return (
            <div
              key={insight.title}
              data-insight-index={index}
              data-active={isActive}
              aria-hidden={!isActive}
              className={`absolute inset-0 flex items-start gap-3 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-eme-500/25 text-eme-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{insight.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{insight.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
        {INSIGHTS.map((insight, index) => (
          <span
            key={insight.title}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-500 ${
              index === active ? 'w-8 bg-eme-300' : 'w-1.5 bg-white/35'
            }`}
          />
        ))}
      </div>
    </aside>
  )
}
