'use client'

import { useEffect, useRef } from 'react'
import { createHeroVideoSequence, HERO_VIDEO_SOURCES } from './hero-video-sequence'
import styles from './hero-video-background.module.css'

const POSTER = '/marketplace/videos/hero-first-frame.png'

export function HeroVideoBackground() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (root) return createHeroVideoSequence(root)
  }, [])

  // The same two nodes exist in SSR, mobile, desktop and after viewport changes.
  // The controller exclusively owns playback and recycles only the covered layer.
  return <div ref={rootRef} data-hero-video-background aria-hidden="true" className={`${styles.background} absolute inset-0 bg-[#0d1512]`}>
    {[0, 1].map(slot => <video
      key={slot}
      data-hero-video-slot={slot}
      data-source-index={slot}
      data-active={slot === 0}
      src={HERO_VIDEO_SOURCES[slot]}
      poster={POSTER}
      autoPlay={slot === 0}
      muted
      playsInline
      controls={false}
      disablePictureInPicture
      preload="auto"
      onContextMenu={event => event.preventDefault()}
      className={`${styles.video} absolute inset-0 h-full w-full object-cover`}
      style={{ zIndex: slot === 0 ? 2 : 1 }}
    />)}
  </div>
}
