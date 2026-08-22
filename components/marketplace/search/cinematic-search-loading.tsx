'use client'

import Link from 'next/link'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
  type TransitionEvent,
} from 'react'
import { cn } from '@/lib/utils'

type LoadingPhase = 'idle' | 'preparing' | 'playing' | 'holding' | 'exiting'

type SearchVideoSource = {
  src: string
  poster: string
  width: number
  height: number
}

type SearchLoadingContextValue = {
  startSearchLoading: () => void
  finishSearchLoading: () => void
}

const loadingMessages = [
  'Buscando imóveis compatíveis…',
  'Analisando localização e perfil…',
  'Encontrando as melhores opções…',
]

const noop = () => undefined
const SearchLoadingContext = createContext<SearchLoadingContextValue>({
  startSearchLoading: noop,
  finishSearchLoading: noop,
})

const MESSAGE_INTERVAL_MS = 1_800
const MOBILE_VIDEO: SearchVideoSource = {
  src: '/marketplace/videos/search-loading-mobile.mp4',
  poster: '/marketplace/videos/search-loading-mobile-poster.svg',
  width: 2160,
  height: 3840,
}
const DESKTOP_VIDEO: SearchVideoSource = {
  src: '/marketplace/videos/search-loading-desktop.mp4',
  poster: '/marketplace/videos/search-loading-desktop-poster.svg',
  width: 1280,
  height: 720,
}

export function useMarketplaceSearchLoading() {
  return useContext(SearchLoadingContext)
}

export function MarketplaceSearchLink({
  href,
  children,
  className,
  style,
}: {
  href: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const { startSearchLoading } = useMarketplaceSearchLoading()
  return (
    <Link href={href} className={className} style={style} onClick={startSearchLoading}>
      {children}
    </Link>
  )
}

export function CinematicSearchLoadingProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<LoadingPhase>('idle')
  const [messageIndex, setMessageIndex] = useState(0)
  const [videoSource, setVideoSource] = useState<SearchVideoSource>(DESKTOP_VIDEO)
  const [videoCanPlay, setVideoCanPlay] = useState(false)
  const [resultsReady, setResultsReady] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playbackStartedRef = useRef(false)

  const startSearchLoading = useCallback(() => {
    const source = window.matchMedia('(max-width: 767px)').matches ? MOBILE_VIDEO : DESKTOP_VIDEO
    playbackStartedRef.current = false
    setMessageIndex(0)
    setVideoSource(source)
    setVideoCanPlay(false)
    setResultsReady(false)
    setVideoEnded(false)
    setPhase('preparing')
  }, [])

  const finishSearchLoading = useCallback(() => {
    setResultsReady(true)
  }, [])

  useEffect(() => {
    if (phase !== 'idle' && phase !== 'exiting' && resultsReady && videoEnded) setPhase('exiting')
  }, [phase, resultsReady, videoEnded])

  useEffect(() => {
    if (phase === 'idle' || phase === 'exiting') return
    const messageTimer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length)
    }, MESSAGE_INTERVAL_MS)
    return () => window.clearInterval(messageTimer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'preparing' || !videoCanPlay || playbackStartedRef.current) return
    const frame = window.requestAnimationFrame(() => {
      const video = videoRef.current
      if (!video) return
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.controls = false
      try {
        video.currentTime = 0
      } catch {
        // O arquivo pronto permanece no primeiro quadro disponível.
      }
      playbackStartedRef.current = true
      void video.play().then(() => {
        setPhase('playing')
      }).catch(() => {
        playbackStartedRef.current = false
        setVideoCanPlay(false)
        try {
          video.load()
        } catch {
          // O próximo evento real de mídia fará uma nova tentativa.
        }
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [phase, videoCanPlay])

  const sceneMounted = phase !== 'idle'
  useEffect(() => {
    if (!sceneMounted) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [sceneMounted])

  function handleVideoCanPlay(event: SyntheticEvent<HTMLVideoElement>) {
    if (phase !== 'preparing' || playbackStartedRef.current) return
    const video = event.currentTarget
    video.pause()
    if (video.currentTime !== 0) video.currentTime = 0
    setVideoCanPlay(true)
  }

  function handleVideoEnded() {
    setVideoEnded(true)
    setPhase((current) => current === 'idle' || current === 'exiting' ? current : 'holding')
  }

  function handleSceneTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && event.propertyName === 'opacity' && phase === 'exiting') {
      setPhase('idle')
    }
  }

  return (
    <SearchLoadingContext.Provider value={{ startSearchLoading, finishSearchLoading }}>
      <link rel="preload" as="video" href={MOBILE_VIDEO.src} type="video/mp4" media="(max-width: 767px)" />
      <link rel="preload" as="video" href={DESKTOP_VIDEO.src} type="video/mp4" media="(min-width: 768px)" />
      <link rel="preload" as="image" href={MOBILE_VIDEO.poster} media="(max-width: 767px)" />
      <link rel="preload" as="image" href={DESKTOP_VIDEO.poster} media="(min-width: 768px)" />
      {children}
      {sceneMounted ? (
        <div
          className={cn(
            'fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-[#101712] transition-opacity duration-700 ease-out',
            phase === 'exiting' ? 'opacity-0' : 'opacity-100',
          )}
          onTransitionEnd={handleSceneTransitionEnd}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={loadingMessages[messageIndex]}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${videoSource.poster}")` }}
            aria-hidden="true"
          />
          <video
            ref={(node) => {
              videoRef.current = node
              if (node) {
                node.muted = true
                node.defaultMuted = true
                node.playsInline = true
                node.controls = false
              }
            }}
            src={videoSource.src}
            poster={videoSource.poster}
            width={videoSource.width}
            height={videoSource.height}
            autoPlay
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            preload="auto"
            onLoadedData={handleVideoCanPlay}
            onCanPlay={handleVideoCanPlay}
            onCanPlayThrough={handleVideoCanPlay}
            onEnded={handleVideoEnded}
            className={cn(
              'absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-350',
              videoCanPlay ? 'opacity-100' : 'opacity-0',
            )}
            onContextMenu={(event) => event.preventDefault()}
            aria-hidden="true"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,10,.08)_0%,rgba(8,15,10,.04)_42%,rgba(8,15,10,.72)_100%)]" />
          <div className="absolute inset-x-0 bottom-[max(3rem,env(safe-area-inset-bottom))] px-6 text-center md:bottom-14 md:px-10">
            <p
              key={messageIndex}
              className="mx-auto max-w-lg text-balance text-sm font-medium tracking-[0.02em] text-white/90 drop-shadow-[0_2px_16px_rgba(0,0,0,.65)] animate-in fade-in slide-in-from-bottom-1 duration-500 md:text-base"
            >
              {loadingMessages[messageIndex]}
            </p>
            <div className="mx-auto mt-4 h-px w-20 overflow-hidden bg-white/20" aria-hidden="true">
              <span className="block h-full w-1/2 bg-white/75 motion-safe:animate-[pulse_1.8s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      ) : null}
    </SearchLoadingContext.Provider>
  )
}
