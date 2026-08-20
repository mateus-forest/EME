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
} from 'react'
import { cn } from '@/lib/utils'

type LoadingPhase = 'idle' | 'active' | 'exiting'

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
const EXIT_DURATION_MS = 700

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
  const [playbackKey, setPlaybackKey] = useState(0)
  const [resultsReady, setResultsReady] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startSearchLoading = useCallback(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current)
    exitTimer.current = null
    setMessageIndex(0)
    setResultsReady(false)
    setVideoEnded(false)
    setPlaybackKey((current) => current + 1)
    setPhase('active')
  }, [])

  const finishSearchLoading = useCallback(() => {
    setResultsReady(true)
  }, [])

  useEffect(() => {
    if (phase === 'active' && resultsReady && videoEnded) setPhase('exiting')
  }, [phase, resultsReady, videoEnded])

  useEffect(() => {
    if (phase !== 'active') return
    const messageTimer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length)
    }, MESSAGE_INTERVAL_MS)
    return () => window.clearInterval(messageTimer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'exiting') return
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null
      setPhase('idle')
    }, EXIT_DURATION_MS)
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
  }, [phase])

  useEffect(() => {
    const visible = phase !== 'idle'
    if (!visible) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [phase])

  return (
    <SearchLoadingContext.Provider value={{ startSearchLoading, finishSearchLoading }}>
      {children}
      {phase !== 'idle' ? (
        <div
          className={cn(
            'fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-[#101712] transition-opacity duration-700 ease-out motion-reduce:transition-none',
            phase === 'exiting' ? 'opacity-0' : 'opacity-100',
          )}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={loadingMessages[messageIndex]}
        >
          <video
            key={playbackKey}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={() => setVideoEnded(true)}
            onError={() => setVideoEnded(true)}
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden="true"
          >
            <source src="/marketplace/videos/search-loading-mobile.mp4" media="(max-width: 767px)" type="video/mp4" />
            <source src="/marketplace/videos/search-loading-desktop.mp4" type="video/mp4" />
          </video>

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
