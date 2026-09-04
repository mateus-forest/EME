'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SOURCES = [
  '/marketplace/videos/hero-1.mp4',
  '/marketplace/videos/hero-2.mp4',
  '/marketplace/videos/hero-3.mp4',
  '/marketplace/videos/hero-4.mp4',
  '/marketplace/videos/hero-5.mp4',
]

const CROSSFADE_SECONDS = 2.4

export function HeroVideoBackground() {
  const [reduced, setReduced] = useState(false)
  const [isInViewport, setIsInViewport] = useState(true)
  const [slotSources, setSlotSources] = useState<[number, number]>([0, 1])
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0)
  const [outgoingSlot, setOutgoingSlot] = useState<0 | 1 | null>(null)
  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null])
  const rootRef = useRef<HTMLDivElement>(null)
  const isInViewportRef = useRef(true)
  const slotSourcesRef = useRef<[number, number]>([0, 1])
  const activeSlotRef = useRef<0 | 1>(0)
  const outgoingSlotRef = useRef<0 | 1 | null>(null)
  const transitioningRef = useRef(false)
  const cleanupTimerRef = useRef<number | null>(null)

  useEffect(() => {
    activeSlotRef.current = activeSlot
  }, [activeSlot])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = entry.isIntersecting
        isInViewportRef.current = nextVisible
        setIsInViewport(nextVisible)
      },
      { threshold: 0.05 },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const playVideo = useCallback(async (video: HTMLVideoElement | null) => {
    if (!video || !isInViewportRef.current || document.hidden) return false
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

  const preloadVideo = useCallback((slot: 0 | 1) => {
    const video = videoRefs.current[slot]
    if (!video || !isInViewportRef.current || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return
    video.preload = 'auto'
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load()
  }, [])

  const finishCrossfade = useCallback((slot: 0 | 1) => {
    if (outgoingSlotRef.current !== slot) return
    const outgoing = videoRefs.current[slot]
    outgoing?.pause()
    if (outgoing) {
      try {
        outgoing.currentTime = 0
      } catch {
        // The slot receives the next source immediately after the transition.
      }
    }

    const currentSources = slotSourcesRef.current
    const activeSource = currentSources[activeSlotRef.current]
    const nextSources: [number, number] = [...currentSources]
    nextSources[slot] = (activeSource + 1) % SOURCES.length
    slotSourcesRef.current = nextSources
    setSlotSources(nextSources)

    outgoingSlotRef.current = null
    setOutgoingSlot(null)
    transitioningRef.current = false
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current)
      cleanupTimerRef.current = null
    }
  }, [])

  const beginCrossfade = useCallback(async (fromSlot: 0 | 1) => {
    if (reduced || !isInViewportRef.current || fromSlot !== activeSlotRef.current || transitioningRef.current) return

    const nextSlot = (fromSlot === 0 ? 1 : 0) as 0 | 1
    const outgoing = videoRefs.current[fromSlot]
    const incoming = videoRefs.current[nextSlot]
    if (!outgoing || !incoming) return

    preloadVideo(nextSlot)
    if (incoming.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

    transitioningRef.current = true
    outgoing.pause()
    try {
      incoming.currentTime = 0
    } catch {
      // A newly loaded clip already starts at its first frame.
    }

    const started = await playVideo(incoming)
    if (!started) {
      transitioningRef.current = false
      void playVideo(outgoing)
      return
    }

    activeSlotRef.current = nextSlot
    outgoingSlotRef.current = fromSlot
    setOutgoingSlot(fromSlot)
    setActiveSlot(nextSlot)

    cleanupTimerRef.current = window.setTimeout(
      () => finishCrossfade(fromSlot),
      CROSSFADE_SECONDS * 1000 + 250,
    )
  }, [finishCrossfade, playVideo, preloadVideo, reduced])

  useEffect(() => {
    if (reduced || !isInViewport) {
      videoRefs.current.forEach((video) => video?.pause())
      return
    }

    const current = videoRefs.current[activeSlot]
    const nextSlot = (activeSlot === 0 ? 1 : 0) as 0 | 1
    videoRefs.current.forEach((video, slot) => {
      if (slot !== activeSlot) video?.pause()
    })
    preloadVideo(activeSlot)
    preloadVideo(nextSlot)
    void playVideo(current)
  }, [activeSlot, isInViewport, playVideo, preloadVideo, reduced])

  useEffect(() => {
    if (reduced) return

    const resumeActive = () => {
      if (document.hidden || !isInViewportRef.current) {
        videoRefs.current.forEach((video) => video?.pause())
        return
      }
      videoRefs.current.forEach((video, slot) => {
        if (slot !== activeSlotRef.current) video?.pause()
      })
      void playVideo(videoRefs.current[activeSlotRef.current])
    }

    document.addEventListener('visibilitychange', resumeActive)
    window.addEventListener('pageshow', resumeActive)
    window.addEventListener('focus', resumeActive)
    return () => {
      document.removeEventListener('visibilitychange', resumeActive)
      window.removeEventListener('pageshow', resumeActive)
      window.removeEventListener('focus', resumeActive)
    }
  }, [playVideo, reduced])

  useEffect(() => () => {
    videoRefs.current.forEach((video) => video?.pause())
    outgoingSlotRef.current = null
    if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current)
  }, [])

  if (reduced) {
    return (
      <div ref={rootRef} aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
        <video
          src={SOURCES[0]}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onLoadedMetadata={(event) => {
            try {
              event.currentTarget.currentTime = 0.1
            } catch {
              // Keep the first available frame.
            }
          }}
        />
      </div>
    )
  }

  return (
    <div ref={rootRef} aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
      {slotSources.map((sourceIndex, slotIndex) => {
        const slot = slotIndex as 0 | 1
        const source = SOURCES[sourceIndex]
        const isActive = slot === activeSlot
        const isOutgoing = slot === outgoingSlot
        return (
          <video
            key={`hero-video-slot-${slot}`}
            ref={(node) => {
              videoRefs.current[slot] = node
              if (node) {
                node.muted = true
                node.defaultMuted = true
                node.playsInline = true
                node.controls = false
              }
            }}
            src={source}
            autoPlay={isActive && isInViewport}
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            preload={isInViewport ? "auto" : "metadata"}
            onTimeUpdate={(event) => {
              if (!isActive || transitioningRef.current) return
              const video = event.currentTarget
              if (!Number.isFinite(video.duration) || video.duration <= 0) return
              if (video.duration - video.currentTime <= CROSSFADE_SECONDS) void beginCrossfade(slot)
            }}
            onEnded={isActive ? () => void beginCrossfade(slot) : undefined}
            onCanPlay={() => {
              if (isActive) {
                void playVideo(videoRefs.current[slot])
                return
              }
              const current = videoRefs.current[activeSlotRef.current]
              if (current?.ended) {
                void beginCrossfade(activeSlotRef.current)
              }
            }}
            onTransitionEnd={(event) => {
              if (event.propertyName === 'opacity' && isOutgoing) finishCrossfade(slot)
            }}
            onContextMenu={(event) => event.preventDefault()}
            style={{ willChange: 'opacity' }}
            className={`absolute inset-0 h-full w-full object-cover [transition:opacity_2400ms_cubic-bezier(0.4,0,0.2,1)] ${isActive ? 'opacity-100' : 'opacity-0'}`}
          />
        )
      })}
    </div>
  )
}
