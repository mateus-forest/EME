'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Vídeos originais, mantidos separados e exibidos nesta ordem.
const SOURCES = [
  '/marketplace/videos/hero-1.mp4',
  '/marketplace/videos/hero-2.mp4',
  '/marketplace/videos/hero-3.mp4',
  '/marketplace/videos/hero-4.mp4',
  '/marketplace/videos/hero-5.mp4',
]

const CROSSFADE_SECONDS = 2.4
type VideoSlot = 0 | 1

export function HeroVideoBackground() {
  const [reduced, setReduced] = useState(false)
  const [slotSources, setSlotSources] = useState<[number, number]>([0, 1])
  const [activeSlot, setActiveSlot] = useState<VideoSlot>(0)
  const [crossfading, setCrossfading] = useState(false)
  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null])
  const transitioningRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      if (mq.matches) {
        transitioningRef.current = false
        setCrossfading(false)
        setActiveSlot(0)
        setSlotSources([0, 1])
      }
      setReduced(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const playVideo = useCallback(async (video: HTMLVideoElement | null) => {
    if (!video) return false
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.controls = false
    try {
      await video.play()
      return true
    } catch {
      return false
    }
  }, [])

  // Mantém somente o vídeo atual em reprodução e o próximo preparado para a troca.
  useEffect(() => {
    if (reduced) return

    void playVideo(videoRefs.current[activeSlot])
    const standbySlot = (activeSlot === 0 ? 1 : 0) as VideoSlot
    const standbyVideo = videoRefs.current[standbySlot]
    if (standbyVideo && standbyVideo.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      standbyVideo.preload = 'auto'
      try {
        standbyVideo.load()
      } catch {
        // O preload declarativo permanece como fallback.
      }
    }
  }, [activeSlot, playVideo, reduced, slotSources])

  useEffect(() => {
    if (reduced) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        videoRefs.current.forEach((video) => video?.pause())
        return
      }

      void playVideo(videoRefs.current[activeSlot])
      if (crossfading) {
        const incomingSlot = (activeSlot === 0 ? 1 : 0) as VideoSlot
        void playVideo(videoRefs.current[incomingSlot])
      }
    }

    const resumePlayback = () => {
      if (document.hidden) return
      void playVideo(videoRefs.current[activeSlot])
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', resumePlayback)
    window.addEventListener('focus', resumePlayback)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', resumePlayback)
      window.removeEventListener('focus', resumePlayback)
    }
  }, [activeSlot, crossfading, playVideo, reduced])

  const beginCrossfade = useCallback(
    async (fromSlot: VideoSlot) => {
      if (reduced || fromSlot !== activeSlot || transitioningRef.current) return

      const nextSlot = (fromSlot === 0 ? 1 : 0) as VideoSlot
      const nextVideo = videoRefs.current[nextSlot]
      if (!nextVideo) return

      transitioningRef.current = true
      try {
        nextVideo.currentTime = 0
      } catch {
        // O clipe já carregado normalmente começa no quadro inicial.
      }

      const started = await playVideo(nextVideo)
      if (!started) {
        transitioningRef.current = false
        return
      }

      // O fade só começa depois que o próximo vídeo efetivamente iniciou.
      requestAnimationFrame(() => setCrossfading(true))
    },
    [activeSlot, playVideo, reduced],
  )

  const finishCrossfade = useCallback(
    (fromSlot: VideoSlot) => {
      if (!crossfading || fromSlot !== activeSlot || !transitioningRef.current) return

      const nextSlot = (fromSlot === 0 ? 1 : 0) as VideoSlot
      const outgoingVideo = videoRefs.current[fromSlot]
      if (outgoingVideo) {
        outgoingVideo.pause()
        try {
          outgoingVideo.currentTime = 0
        } catch {
          // O src será trocado logo depois, então não é necessário forçar o seek.
        }
      }

      setSlotSources((current) => {
        const updated: [number, number] = [...current]
        updated[fromSlot] = (current[nextSlot] + 1) % SOURCES.length
        return updated
      })
      setActiveSlot(nextSlot)
      setCrossfading(false)
      transitioningRef.current = false
    },
    [activeSlot, crossfading],
  )

  const handleTimeUpdate = useCallback(
    (slot: VideoSlot) => (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (slot !== activeSlot || transitioningRef.current) return
      const video = event.currentTarget
      const { duration, currentTime } = video
      if (!duration || Number.isNaN(duration) || !Number.isFinite(duration)) return
      if (duration - currentTime <= CROSSFADE_SECONDS) void beginCrossfade(slot)
    },
    [activeSlot, beginCrossfade],
  )

  if (reduced) {
    return (
      <div aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
        <video
          src={SOURCES[0]}
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
          onLoadedMetadata={(event) => {
            try {
              event.currentTarget.currentTime = 0.1
            } catch {
              // Mantém o quadro inicial quando o navegador não permite seek.
            }
          }}
        />
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
      {([0, 1] as const).map((slot) => {
        const isActive = slot === activeSlot
        const visible = crossfading ? !isActive : isActive

        return (
          <video
            key={slot}
            ref={(node) => {
              videoRefs.current[slot] = node
              if (node) {
                node.muted = true
                node.defaultMuted = true
                node.playsInline = true
                node.controls = false
              }
            }}
            src={SOURCES[slotSources[slot]]}
            autoPlay={isActive}
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            preload="auto"
            onTimeUpdate={handleTimeUpdate(slot)}
            onEnded={isActive ? () => void beginCrossfade(slot) : undefined}
            onLoadedData={() => {
              if (isActive) void playVideo(videoRefs.current[slot])
            }}
            onCanPlay={() => {
              if (isActive) {
                void playVideo(videoRefs.current[slot])
                return
              }
              const currentVideo = videoRefs.current[activeSlot]
              if (
                currentVideo?.ended ||
                (currentVideo?.duration &&
                  Number.isFinite(currentVideo.duration) &&
                  currentVideo.duration - currentVideo.currentTime <= CROSSFADE_SECONDS)
              ) {
                void beginCrossfade(activeSlot)
              }
            }}
            onTransitionEnd={() => {
              if (isActive) finishCrossfade(slot)
            }}
            style={{ willChange: 'opacity' }}
            onContextMenu={(event) => event.preventDefault()}
            className={`absolute inset-0 h-full w-full object-cover [transition:opacity_2400ms_cubic-bezier(0.4,0,0.2,1)] ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )
      })}
    </div>
  )
}
