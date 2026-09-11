export const HERO_VIDEO_SOURCES = [
  '/marketplace/videos/hero-1.mp4',
  '/marketplace/videos/hero-2.mp4',
  '/marketplace/videos/hero-3.mp4',
  '/marketplace/videos/hero-4.mp4',
  '/marketplace/videos/hero-5.mp4',
] as const

const CROSSFADE_MS = 2400
const PLAY_ATTEMPT_MS = 1500
type Slot = 0 | 1
const other = (slot: Slot): Slot => slot === 0 ? 1 : 0

/** One owner for both persistent layers; neither React nor a second hook pauses them. */
export function createHeroVideoSequence(root: HTMLDivElement) {
  const videos = [root.querySelector<HTMLVideoElement>('[data-hero-video-slot="0"]')!, root.querySelector<HTMLVideoElement>('[data-hero-video-slot="1"]')!] as const
  // React can disconnect/reconnect effects while preserving DOM (route Activity,
  // Fast Refresh). Resume the existing sequence, including an interrupted fade.
  const sources = videos.map((video, slot) => Number(video.dataset.sourceIndex ?? slot))
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let active: Slot = videos[1].dataset.active === 'true' ? 1 : 0
  let incoming: Slot | null = root.dataset.incoming === '0' ? 0 : root.dataset.incoming === '1' ? 1 : null
  let outgoing: Slot | null = root.dataset.outgoing === '0' ? 0 : root.dataset.outgoing === '1' ? 1 : null
  let disposed = false
  let pageHidden = document.hidden
  let inViewport = true
  let attempt = 0
  let pendingUntil = 0
  let retryAt = 0
  let failures = 0
  const progressTimes = videos.map(video => video.currentTime)
  const progressAt = videos.map(() => performance.now())
  let frame: { video: HTMLVideoElement; id: number } | null = null
  let fadeTimer: ReturnType<typeof setTimeout> | undefined
  const removeListeners: Array<() => void> = []

  const listen = (target: EventTarget, name: string, handler: EventListener) => {
    target.addEventListener(name, handler)
    removeListeners.push(() => target.removeEventListener(name, handler))
  }
  const allowed = () => !disposed && !pageHidden && !document.hidden && inViewport && !reduced.matches
  const configure = (video: HTMLVideoElement) => {
    // defaultMuted is a DOM property, not a React video prop. Set it on both
    // layers at mount and immediately before every native play() attempt.
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.controls = false
  }
  const cancelFrame = () => {
    if (frame) frame.video.cancelVideoFrameCallback(frame.id)
    frame = null
  }
  const resetAttempt = () => { attempt++; pendingUntil = 0; retryAt = 0; failures = 0 }
  const pause = () => {
    resetAttempt()
    cancelFrame()
    videos.forEach(video => { if (!video.paused) video.pause() })
  }

  const finishFade = () => {
    if (disposed || outgoing === null) return
    const slot = outgoing
    const video = videos[slot]
    // A throttled/background CSS transition may not have finished yet. Never
    // replace the source while any of its last frame is still on screen.
    if (Number(getComputedStyle(video).opacity) > .001) return
    clearTimeout(fadeTimer)
    video.pause()
    video.autoplay = false
    video.style.transition = 'none'
    video.style.zIndex = '0'
    sources[slot] = (sources[active] + 1) % HERO_VIDEO_SOURCES.length
    video.dataset.sourceIndex = String(sources[slot])
    video.src = HERO_VIDEO_SOURCES[sources[slot]]
    outgoing = null
    delete root.dataset.outgoing
    root.dataset.phase = 'playing'
    drive()
  }

  const present = (slot: Slot) => {
    if (!allowed() || incoming !== slot || videos[slot].paused || videos[slot].readyState < 2) return
    cancelFrame()
    const previous = active
    active = slot
    incoming = null
    outgoing = previous
    delete root.dataset.incoming
    root.dataset.outgoing = String(previous)
    resetAttempt()
    videos[active].dataset.active = 'true'
    videos[previous].dataset.active = 'false'
    videos[previous].autoplay = false
    // Keep the decoded incoming layer fully opaque UNDER the complete last
    // frame. Fade only that outgoing frame, so the background never shows through.
    videos[previous].style.transition = `opacity ${CROSSFADE_MS}ms ease`
    videos[previous].style.opacity = '0'
    root.dataset.phase = 'crossfading'
    fadeTimer = setTimeout(finishFade, CROSSFADE_MS + 150)
  }

  const waitForFrame = (slot: Slot) => {
    if (frame || incoming !== slot || !allowed()) return
    const video = videos[slot]
    if (typeof video.requestVideoFrameCallback === 'function') {
      const id = video.requestVideoFrameCallback(() => { frame = null; present(slot) })
      frame = { video, id }
    } else if (video.readyState >= 2 && !video.paused) {
      // Older WebKit: playing + HAVE_CURRENT_DATA guarantees a decoded frame.
      present(slot)
    }
  }

  const play = (slot: Slot) => {
    const video = videos[slot]
    if (!allowed() || video.ended || video.readyState < 2) return
    const now = performance.now()
    if (Math.abs(video.currentTime - progressTimes[slot]) > .01) {
      progressTimes[slot] = video.currentTime
      progressAt[slot] = now
    }
    if (!video.paused && now - progressAt[slot] < 2000) {
      if (incoming === slot) waitForFrame(slot)
      return
    }
    if (now < pendingUntil || now < retryAt) return
    const token = ++attempt
    pendingUntil = now + PLAY_ATTEMPT_MS
    configure(video)
    video.autoplay = true
    void video.play().then(() => {
      if (disposed || token !== attempt) return
      pendingUntil = 0
      failures = 0
      if (!allowed()) video.pause()
      else if (incoming === slot) waitForFrame(slot)
    }).catch(() => {
      if (disposed || token !== attempt) return
      pendingUntil = 0
      // Retry while visible, with capped backoff. A rejected or never-settled
      // promise cannot permanently lock recovery after Safari suspends playback.
      retryAt = performance.now() + Math.min(250 * 2 ** Math.min(failures++, 4), 3000)
    })
  }

  function drive() {
    if (!allowed()) { pause(); return }
    if (incoming !== null) { play(incoming); return }
    const current = videos[active]
    if (!current.ended) { play(active); return }
    if (outgoing !== null) { finishFade(); return }
    const next = other(active)
    // No clock/timeupdate threshold. Native ended is the only advance signal;
    // the flag also survives a queued ended event during page suspension.
    if (videos[next].readyState < 3) {
      root.dataset.phase = 'waiting'
      return
    }
    incoming = next
    root.dataset.incoming = String(next)
    resetAttempt()
    current.style.zIndex = '2'
    videos[next].style.transition = 'none'
    videos[next].style.zIndex = '1'
    videos[next].style.opacity = '1'
    root.dataset.phase = 'preparing'
    play(next)
  }

  const checkViewport = () => {
    const rect = root.getBoundingClientRect()
    // Ignore unmeasurable/stale initial observer entries; check the real box.
    if (rect.width && rect.height) {
      const viewport = window.visualViewport
      const top = viewport?.offsetTop ?? 0, left = viewport?.offsetLeft ?? 0
      inViewport = rect.bottom > top && rect.top < top + (viewport?.height ?? innerHeight) && rect.right > left && rect.left < left + (viewport?.width ?? innerWidth)
    }
    drive()
  }
  const resume = () => {
    pageHidden = document.hidden
    resetAttempt()
    checkViewport()
    finishFade()
  }

  videos.forEach((video, index) => {
    const slot = index as Slot
    configure(video)
    video.autoplay = slot === (incoming ?? active)
    if (slot !== (incoming ?? active)) video.pause()
    listen(video, 'loadeddata', () => { drive() })
    listen(video, 'canplay', () => { drive() })
    listen(video, 'play', () => {
      if (!allowed() || slot !== (incoming ?? active)) video.pause()
    })
    listen(video, 'playing', () => {
      if (!allowed() || slot !== (incoming ?? active)) { video.pause(); return }
      resetAttempt()
      if (incoming === slot) waitForFrame(slot)
      else if (outgoing === null) root.dataset.phase = 'playing'
    })
    listen(video, 'ended', () => { if (slot === active) drive() })
    listen(video, 'transitionend', event => {
      if ((event as TransitionEvent).propertyName === 'opacity' && outgoing === slot) finishFade()
    })
  })
  listen(window, 'pagehide', () => { pageHidden = true; pause() })
  listen(window, 'pageshow', resume)
  listen(document, 'visibilitychange', resume)
  listen(window, 'focus', resume)
  listen(window, 'online', resume)
  listen(reduced, 'change', resume)
  listen(window, 'resize', checkViewport)
  if (window.visualViewport) {
    listen(window.visualViewport, 'resize', checkViewport)
    listen(window.visualViewport, 'scroll', checkViewport)
  }
  // Autoplay attempts happen independently of input. These are recovery only
  // when a device explicitly restricts autoplay; no play button is introduced.
  listen(document, 'touchend', () => { resetAttempt(); drive() })
  listen(document, 'click', () => { resetAttempt(); drive() })
  const observer = new IntersectionObserver(checkViewport, { threshold: 0 })
  observer.observe(root)
  // Lifecycle/readiness events can be swallowed when a WebKit page is suspended.
  // This timer retries play, never seeks, loads, skips a clip or changes a source.
  const watchdog = setInterval(() => { drive(); finishFade() }, 750)
  root.dataset.playerReady = 'true'
  checkViewport()

  return () => {
    disposed = true
    delete root.dataset.playerReady
    removeListeners.forEach(remove => remove())
    observer.disconnect()
    clearInterval(watchdog)
    clearTimeout(fadeTimer)
    pause()
  }
}
