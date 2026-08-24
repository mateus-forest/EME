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
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null)
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const activeIndexRef = useRef(0)
  const outgoingIndexRef = useRef<number | null>(null)
  const transitioningRef = useRef(false)
  const cleanupTimerRef = useRef<number | null>(null)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
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

  const preloadVideo = useCallback((index: number) => {
    const video = videoRefs.current[index]
    if (!video || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return
    video.preload = 'auto'
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load()
  }, [])

  const finishCrossfade = useCallback((index: number) => {
    if (outgoingIndexRef.current !== index) return
    const outgoing = videoRefs.current[index]
    outgoing?.pause()
    if (outgoing) {
      try {
        outgoing.currentTime = 0
      } catch {
        // The stable source stays mounted and will be ready for the next cycle.
      }
    }
    outgoingIndexRef.current = null
    setOutgoingIndex(null)
    transitioningRef.current = false
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current)
      cleanupTimerRef.current = null
    }
  }, [])

  const beginCrossfade = useCallback(async (fromIndex: number) => {
    if (reduced || fromIndex !== activeIndexRef.current || transitioningRef.current) return

    const nextIndex = (fromIndex + 1) % SOURCES.length
    const outgoing = videoRefs.current[fromIndex]
    const incoming = videoRefs.current[nextIndex]
    if (!outgoing || !incoming) return

    preloadVideo(nextIndex)
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

    activeIndexRef.current = nextIndex
    outgoingIndexRef.current = fromIndex
    setOutgoingIndex(fromIndex)
    setActiveIndex(nextIndex)
    preloadVideo((nextIndex + 1) % SOURCES.length)

    cleanupTimerRef.current = window.setTimeout(
      () => finishCrossfade(fromIndex),
      CROSSFADE_SECONDS * 1000 + 250,
    )
  }, [finishCrossfade, playVideo, preloadVideo, reduced])

  useEffect(() => {
    if (reduced) {
      videoRefs.current.forEach((video) => video?.pause())
      return
    }

    const current = videoRefs.current[activeIndex]
    const nextIndex = (activeIndex + 1) % SOURCES.length
    videoRefs.current.forEach((video, index) => {
      if (index !== activeIndex) video?.pause()
    })
    preloadVideo(activeIndex)
    preloadVideo(nextIndex)
    void playVideo(current)
  }, [activeIndex, playVideo, preloadVideo, reduced])

  useEffect(() => {
    if (reduced) return

    const resumeActive = () => {
      if (document.hidden) {
        videoRefs.current.forEach((video) => video?.pause())
        return
      }
      videoRefs.current.forEach((video, index) => {
        if (index !== activeIndexRef.current) video?.pause()
      })
      void playVideo(videoRefs.current[activeIndexRef.current])
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
    outgoingIndexRef.current = null
    if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current)
  }, [])

  if (reduced) {
    return (
      <div aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
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

  const nextIndex = (activeIndex + 1) % SOURCES.length

  return (
    <div aria-hidden="true" className="absolute inset-0 bg-[#0d1512]">
      {SOURCES.map((source, index) => {
        const isActive = index === activeIndex
        const isOutgoing = index === outgoingIndex
        return (
          <video
            key={source}
            ref={(node) => {
              videoRefs.current[index] = node
              if (node) {
                node.muted = true
                node.defaultMuted = true
                node.playsInline = true
                node.controls = false
              }
            }}
            src={source}
            autoPlay={isActive}
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            preload={isActive || index === nextIndex ? 'auto' : 'none'}
            onTimeUpdate={(event) => {
              if (!isActive || transitioningRef.current) return
              const video = event.currentTarget
              if (!Number.isFinite(video.duration) || video.duration <= 0) return
              if (video.duration - video.currentTime <= CROSSFADE_SECONDS) void beginCrossfade(index)
            }}
            onEnded={isActive ? () => void beginCrossfade(index) : undefined}
            onCanPlay={() => {
              if (isActive) {
                void playVideo(videoRefs.current[index])
                return
              }
              const current = videoRefs.current[activeIndexRef.current]
              if (index === (activeIndexRef.current + 1) % SOURCES.length && current?.ended) {
                void beginCrossfade(activeIndexRef.current)
              }
            }}
            onTransitionEnd={(event) => {
              if (event.propertyName === 'opacity' && isOutgoing) finishCrossfade(index)
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
