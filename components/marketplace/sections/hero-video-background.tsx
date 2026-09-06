'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useInlineVideoPlayback } from '../use-inline-video-playback'

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
  const [covered, setCovered] = useState(false)
  const coveredRef = useRef(false)
  const [slotSources, setSlotSources] = useState<[number, number]>([0, 1])
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0)
  const [outgoingSlot, setOutgoingSlot] = useState<0 | 1 | null>(null)
  const [prepared, setPrepared] = useState<[number, number]>([0, -1])
  const firstRef = useRef<HTMLVideoElement>(null)
  const secondRef = useRef<HTMLVideoElement>(null)
  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null])
  const rootRef = useRef<HTMLDivElement>(null)
  const isInViewportRef = useRef(true)
  const slotSourcesRef = useRef<[number, number]>([0, 1])
  const activeSlotRef = useRef<0 | 1>(0)
  const outgoingSlotRef = useRef<0 | 1 | null>(null)
  const transitioningRef = useRef(false)
  const cleanupTimerRef = useRef<number | null>(null)
  useInlineVideoPlayback(firstRef, !reduced && !covered && isInViewport && (activeSlot === 0 || outgoingSlot === 0))
  useInlineVideoPlayback(secondRef, !reduced && !covered && isInViewport && (activeSlot === 1 || outgoingSlot === 1))
  useEffect(() => {
    const update = (event: Event) => {
      coveredRef.current = Boolean((event as CustomEvent<boolean>).detail)
      setCovered(coveredRef.current)
    }
    window.addEventListener('eme:search-video', update)
    return () => window.removeEventListener('eme:search-video', update)
  }, [])

  useEffect(() => {
    activeSlotRef.current = activeSlot
  }, [activeSlot])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = root.getBoundingClientRect()
        // Safari can deliver a stale initial non-intersecting entry during layout.
        // Pause only when the actual rectangle is entirely outside the viewport.
        if (!rect.width || !rect.height) return
        const viewport = window.visualViewport
        const top = viewport?.offsetTop ?? 0
        const left = viewport?.offsetLeft ?? 0
        const nextVisible = rect.bottom > top && rect.top < top + (viewport?.height ?? window.innerHeight) && rect.right > left && rect.left < left + (viewport?.width ?? window.innerWidth)
        isInViewportRef.current = nextVisible
        setIsInViewport(nextVisible)
      })
    }
    const observer = new IntersectionObserver(check, { threshold: 0 })
    observer.observe(root)
    check()
    window.addEventListener('pageshow', check)
    window.visualViewport?.addEventListener('resize', check)
    window.visualViewport?.addEventListener('scroll', check)
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      window.removeEventListener('pageshow', check)
      window.visualViewport?.removeEventListener('resize', check)
      window.visualViewport?.removeEventListener('scroll', check)
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const playVideo = useCallback(async (video: HTMLVideoElement | null) => {
    if (!video || !isInViewportRef.current || coveredRef.current || document.hidden) return false
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
    setPrepared(current => {
      if (current[slot] === slotSourcesRef.current[slot]) return current
      const next: [number, number] = [...current]
      next[slot] = slotSourcesRef.current[slot]
      return next
    })
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
    try {
      incoming.currentTime = 0
    } catch {
      // A newly loaded clip already starts at its first frame.
    }

    const started = await playVideo(incoming)
    if (videoRefs.current[nextSlot] !== incoming || !isInViewportRef.current || coveredRef.current || document.hidden) {
      incoming.pause()
      transitioningRef.current = false
      return
    }
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
    // A clip can finish as Safari suspends the page. Resume the sequence instead
    // of leaving its last frame frozen when the hero becomes visible again.
    const resumeSequence = () => {
      const slot = activeSlotRef.current
      if (videoRefs.current[slot]?.ended) void beginCrossfade(slot)
    }
    resumeSequence()
    document.addEventListener('visibilitychange', resumeSequence)
    window.addEventListener('pageshow', resumeSequence)
    return () => {
      document.removeEventListener('visibilitychange', resumeSequence)
      window.removeEventListener('pageshow', resumeSequence)
    }
  }, [beginCrossfade, covered, isInViewport])

  useEffect(() => () => {
    videoRefs.current.forEach((video) => video?.pause())
    outgoingSlotRef.current = null
    if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current)
  }, [])

  if (reduced) {
    return (
      <div ref={rootRef} aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
        <img
          src="/marketplace/images/hero-residence.png"
          alt=""
          className="h-full w-full object-cover"
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
              if (slot === 0) firstRef.current = node
              else secondRef.current = node
              if (node) {
                node.muted = true
                node.defaultMuted = true
                node.playsInline = true
                node.controls = false
              }
            }}
            src={prepared[slot] === sourceIndex ? source : undefined}
            autoPlay={isActive && isInViewport && !covered}
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            preload={isInViewport && prepared[slot] === sourceIndex ? 'auto' : 'none'}
            onTimeUpdate={(event) => {
              if (!isActive || transitioningRef.current) return
              const video = event.currentTarget
              if (!Number.isFinite(video.duration) || video.duration <= 0) return
              if (video.currentTime > 0.25 && video.duration - video.currentTime <= CROSSFADE_SECONDS + 2) preloadVideo(slot === 0 ? 1 : 0)
              if (video.duration - video.currentTime <= CROSSFADE_SECONDS) void beginCrossfade(slot)
            }}
            onEnded={isActive ? () => void beginCrossfade(slot) : undefined}
            onCanPlay={() => {
              if (isActive) {
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
