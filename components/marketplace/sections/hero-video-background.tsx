'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Vídeos aéreos exibidos em sequência contínua, com crossfade longo e suave.
const SOURCES = [
  '/marketplace/videos/hero-1.mp4',
  '/marketplace/videos/hero-2.mp4',
  '/marketplace/videos/hero-3.mp4',
  '/marketplace/videos/hero-4.mp4',
  '/marketplace/videos/hero-5.mp4',
]

// Duração da sobreposição entre um vídeo e o próximo (em segundos).
// A fusão começa antes do fim, então os dois clipes ficam em movimento durante a troca.
const CROSSFADE_SECONDS = 2.4

export function HeroVideoBackground() {
  const [active, setActive] = useState(0)
  const [reduced, setReduced] = useState(false)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const transitioningRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const safePlay = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return
    const played = video.play()
    if (played && typeof played.catch === 'function') played.catch(() => {})
  }, [])

  // Inicia o primeiro vídeo e mantém o próximo pré-decodificado para evitar travas.
  useEffect(() => {
    if (reduced) return
    safePlay(videoRefs.current[active])
    const next = videoRefs.current[(active + 1) % SOURCES.length]
    if (next) {
      // Pré-aquece a decodificação do próximo clipe sem exibi-lo ainda.
      next.preload = 'auto'
      try {
        next.load()
      } catch {
        // Ignora navegadores que não permitem load() antecipado.
      }
    }
  }, [active, reduced, safePlay])

  const advance = useCallback(
    (from: number) => {
      if (transitioningRef.current) return
      transitioningRef.current = true
      const nextIndex = (from + 1) % SOURCES.length
      const nextVideo = videoRefs.current[nextIndex]
      if (nextVideo) {
        try {
          nextVideo.currentTime = 0
        } catch {
          // Mantém a posição atual caso o seek ainda não seja permitido.
        }
        safePlay(nextVideo)
      }
      // Aguarda um quadro para o próximo vídeo já estar em movimento antes de iniciar o fade.
      requestAnimationFrame(() => {
        setActive(nextIndex)
        transitioningRef.current = false
      })
    },
    [safePlay],
  )

  const handleTimeUpdate = useCallback(
    (index: number) => (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (index !== active || transitioningRef.current) return
      const video = event.currentTarget
      const { duration, currentTime } = video
      if (!duration || Number.isNaN(duration) || !Number.isFinite(duration)) return
      if (duration - currentTime <= CROSSFADE_SECONDS) advance(index)
    },
    [active, advance],
  )

  if (reduced) {
    // Sem movimento: apenas um quadro estático, garantindo legibilidade e acessibilidade.
    return (
      <div aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
        <video
          src={SOURCES[0]}
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget
            try {
              video.currentTime = 0.1
            } catch {
              // Mantém o quadro inicial mesmo sem suporte a seek.
            }
          }}
        />
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
      {SOURCES.map((src, index) => {
        const isActive = index === active
        const isNext = index === (active + 1) % SOURCES.length
        return (
          <video
            key={src}
            ref={(node) => {
              videoRefs.current[index] = node
            }}
            src={src}
            muted
            playsInline
            preload={isActive || isNext ? 'auto' : 'metadata'}
            onTimeUpdate={handleTimeUpdate(index)}
            onEnded={isActive ? () => advance(index) : undefined}
            onTransitionEnd={() => {
              // Após sumir por completo, pausa o clipe anterior para liberar recursos.
              const video = videoRefs.current[index]
              if (video && index !== active) video.pause()
            }}
            style={{ willChange: 'opacity' }}
            className={`absolute inset-0 h-full w-full object-cover [transition:opacity_2400ms_cubic-bezier(0.4,0,0.2,1)] ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )
      })}
    </div>
  )
}
