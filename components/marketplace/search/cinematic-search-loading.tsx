'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EmeLoader } from '../eme-loader'
import { useInlineVideoPlayback } from '../use-inline-video-playback'

type LoadingPhase = 'preparing' | 'playing' | 'holding' | 'exiting'
type SearchVideoSource = { src: string; poster: string; width: number; height: number }
type SearchLoadingContextValue = { startSearchLoading: () => void; finishSearchLoading: () => void }
const noop = () => undefined
const SearchLoadingContext = createContext<SearchLoadingContextValue>({ startSearchLoading: noop, finishSearchLoading: noop })
const loadingMessages = ['Buscando imóveis compatíveis…', 'Analisando localização e perfil…', 'Encontrando as melhores opções…']
const SCENE_FAILSAFE_MS = 15_000
const MOBILE_VIDEO: SearchVideoSource = { src: '/marketplace/videos/search-loading-mobile.mp4', poster: '/marketplace/videos/search-loading-mobile-poster.svg', width: 2160, height: 3840 }
const DESKTOP_VIDEO: SearchVideoSource = { src: '/marketplace/videos/search-loading-desktop.mp4', poster: '/marketplace/videos/search-loading-desktop-poster.svg', width: 1280, height: 720 }

export function useMarketplaceSearchLoading() { return useContext(SearchLoadingContext) }

export function MarketplaceSearchLink({ href, children, className, style }: { href: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  const { startSearchLoading } = useMarketplaceSearchLoading()
  return <Link href={href} className={className} style={style} onClick={(event) => {
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) startSearchLoading()
  }}>{children}</Link>
}

export function CinematicSearchLoadingProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ id: number; source: SearchVideoSource } | null>(null)
  const [resultsReady, setResultsReady] = useState(false)
  const sequence = useRef(0)
  const startSearchLoading = useCallback(() => {
    const source = window.matchMedia('(max-width: 767px)').matches ? MOBILE_VIDEO : DESKTOP_VIDEO
    setResultsReady(false)
    setRequest({ id: ++sequence.current, source })
  }, [])
  const finishSearchLoading = useCallback(() => setResultsReady(true), [])
  const finishScene = useCallback((id: number) => {
    setRequest(current => current?.id === id ? null : current)
  }, [])
  const context = useMemo(() => ({ startSearchLoading, finishSearchLoading }), [startSearchLoading, finishSearchLoading])
  return <SearchLoadingContext.Provider value={context}>
    {children}
    {request && <CinematicSearchScene key={request.id} id={request.id} source={request.source} resultsReady={resultsReady} onComplete={finishScene} />}
  </SearchLoadingContext.Provider>
}

/** Each search owns its video, callbacks and watchdog. Old runs cannot close new ones. */
function CinematicSearchScene({ id, source, resultsReady, onComplete }: { id: number; source: SearchVideoSource; resultsReady: boolean; onComplete: (id: number) => void }) {
  const [phase, setPhase] = useState<LoadingPhase>('preparing')
  const [messageIndex, setMessageIndex] = useState(0)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoFinished, setVideoFinished] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastProgress = useRef(0)
  const lastTime = useRef(0)
  useInlineVideoPlayback(videoRef, !videoFinished && !failure && phase !== 'exiting')

  useEffect(() => {
    // A healthy video always reaches ended; results arriving early cannot cut it short.
    if (resultsReady && (videoFinished || failure)) setPhase('exiting')
  }, [resultsReady, videoFinished, failure])

  useEffect(() => {
    const timer = window.setInterval(() => setMessageIndex(current => (current + 1) % loadingMessages.length), 1800)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    lastProgress.current = performance.now()
    const resetWatchdog = () => { lastProgress.current = performance.now() }
    const timer = window.setInterval(() => {
      if (document.hidden) { resetWatchdog(); return }
      const video = videoRef.current
      // A technical timeout measures lack of progress, not total scene duration.
      if (video && video.currentTime > lastTime.current + .01) {
        lastTime.current = video.currentTime
        resetWatchdog()
      }
      if (performance.now() - lastProgress.current < SCENE_FAILSAFE_MS) return
      if (!videoFinished && !failure) {
        setFailure('playback-timeout')
        setPhase('holding')
        resetWatchdog()
      } else {
        setFailure('search-timeout')
        setPhase('exiting')
      }
    }, 500)
    document.addEventListener('visibilitychange', resetWatchdog)
    window.addEventListener('pageshow', resetWatchdog)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', resetWatchdog)
      window.removeEventListener('pageshow', resetWatchdog)
    }
  }, [failure, videoFinished])

  useEffect(() => {
    if (phase !== 'exiting') return
    const timer = window.setTimeout(() => onComplete(id), 850)
    return () => window.clearTimeout(timer)
  }, [id, onComplete, phase])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.dispatchEvent(new CustomEvent('eme:search-video', { detail: true }))
    return () => {
      document.body.style.overflow = previousOverflow
      window.dispatchEvent(new CustomEvent('eme:search-video', { detail: false }))
    }
  }, [])

  return <div
    data-search-video-scene data-search-run={id} data-phase={phase}
    data-video-finished={videoFinished} data-search-finished={resultsReady} data-video-failure={failure ?? undefined}
    className={cn('fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-[#101712] transition-opacity duration-700 ease-out', phase === 'exiting' ? 'opacity-0' : 'opacity-100')}
    onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'opacity' && phase === 'exiting') onComplete(id) }}
    role="status" aria-live="polite" aria-busy="true" aria-label={loadingMessages[messageIndex]}
  >
    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${source.poster}")` }} aria-hidden="true" />
    <video
      ref={videoRef} src={source.src} poster={source.poster} width={source.width} height={source.height}
      autoPlay muted playsInline controls={false} disablePictureInPicture preload="auto"
      onPlaying={() => { setVideoStarted(true); setPhase(current => current === 'preparing' ? 'playing' : current) }}
      onEnded={() => { setVideoFinished(true); setPhase('holding') }}
      onError={() => { setFailure('media-error'); setPhase('holding') }}
      className={cn('absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-350', videoStarted && !failure ? 'opacity-100' : 'opacity-0')}
      onContextMenu={event => event.preventDefault()} aria-hidden="true"
    />
    {(!videoStarted || failure) && <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true"><EmeLoader size="lg" /></div>}
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,10,.08)_0%,rgba(8,15,10,.04)_42%,rgba(8,15,10,.72)_100%)]" />
    <div className="absolute inset-x-0 bottom-[max(3rem,env(safe-area-inset-bottom))] px-6 text-center md:bottom-14 md:px-10">
      <p key={messageIndex} className="mx-auto max-w-lg text-balance text-sm font-medium tracking-[0.02em] text-white/90 drop-shadow-[0_2px_16px_rgba(0,0,0,.65)] animate-in fade-in slide-in-from-bottom-1 duration-500 md:text-base">{loadingMessages[messageIndex]}</p>
      <div className="mx-auto mt-4 h-px w-20 overflow-hidden bg-white/20" aria-hidden="true"><span className="block h-full w-1/2 bg-white/75 motion-safe:animate-[pulse_1.8s_ease-in-out_infinite]" /></div>
    </div>
  </div>
}
