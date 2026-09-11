"use client"

import { useEffect, useRef } from "react"
import { initializeLanding, loadLandingMotion } from "./landing-interactions"
import { landingMarkup } from "./landing-markup"
import "./landing.css"

// This trusted, static package DOM is managed by the scoped interaction layer.
// Keep the prop identity stable so an auth/router re-render does not replace its
// descendants and detach their event listeners.
const staticMarkup = { __html: landingMarkup }

export function IntegratedLanding() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let disposed = false
    // Controls work immediately using the package's CSS poses, even if a vendor
    // file is unavailable. The optional motion layer preserves the current state.
    let cleanup = initializeLanding(root)
    void loadLandingMotion().then((motion: Parameters<typeof initializeLanding>[1]) => {
      if (disposed || !motion) return
      cleanup()
      cleanup = initializeLanding(root, motion)
    })
    return () => { disposed = true; cleanup() }
  }, [])

  return <div ref={rootRef} className="eme-integrated-landing" dangerouslySetInnerHTML={staticMarkup} />
}
