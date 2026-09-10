'use client'

import { useEffect, useRef, type RefObject } from 'react'

/** Retry transient Safari startup/lifecycle failures without load() or seeking. */
export function useInlineVideoPlayback(ref: RefObject<HTMLVideoElement | null>, enabled: boolean, resumeWhenVisible = false) {
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
    const video = ref.current
    if (!video) return
    let disposed = false
    let pending = false
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const delays = [250, 750, 1500, 3000]
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.controls = false

    const retry = () => {
      if (disposed || timer || !enabled || document.hidden || video.ended || retries >= delays.length) return
      timer = setTimeout(() => { timer = undefined; void play() }, delays[retries++])
    }
    const play = async () => {
      if (disposed || !enabled || document.hidden || pending || video.ended) return
      if (video.readyState < 1) { retry(); return }
      pending = true
      try { await video.play() } catch { retry() } finally { pending = false }
      if (!enabledRef.current || !video.isConnected || document.hidden) video.pause()
    }
    const resume = () => {
      clearTimeout(timer); timer = undefined; retries = 0
      if (!enabled || document.hidden) video.pause()
      else void play()
    }
    const ready = () => { void play() }
    const started = () => { retries = 0; clearTimeout(timer); timer = undefined }
    const hide = () => video.pause()
    video.addEventListener('loadedmetadata', ready)
    video.addEventListener('canplay', ready)
    video.addEventListener('playing', started)
    video.addEventListener('pause', retry)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('pageshow', resume)
    window.addEventListener('pagehide', hide)
    window.addEventListener('focus', resume)
    // iOS can suspend a muted autoplay video when it leaves the visible area.
    // A visibility entry requests recovery only; a stale entry never pauses playback.
    const observer = resumeWhenVisible ? new IntersectionObserver(() => {
      const rect = video.getBoundingClientRect()
      if (rect.width && rect.height && rect.bottom > 0 && rect.top < window.innerHeight) resume()
    }) : null
    observer?.observe(video)
    resume()
    return () => {
      disposed = true
      clearTimeout(timer)
      video.removeEventListener('loadedmetadata', ready)
      video.removeEventListener('canplay', ready)
      video.removeEventListener('playing', started)
      video.removeEventListener('pause', retry)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('focus', resume)
      observer?.disconnect()
      if (enabled) video.pause()
    }
  }, [enabled, ref, resumeWhenVisible])
}
