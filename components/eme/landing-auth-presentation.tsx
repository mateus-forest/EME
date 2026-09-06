"use client"

import { MotionConfig, useIsPresent } from "motion/react"
import { AuthPanel, type AuthMode } from "./auth-panel"
import finish from "./landing-finish.module.css"

/** Landing-only material and presence cadence; authentication stays in AuthPanel. */
export function LandingAuthPresentation(props: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onClose: () => void
}) {
  const present = useIsPresent()
  return <MotionConfig reducedMotion="user">
    <div className={`${finish.root} ${finish.auth}`} data-closing={!present}>
      <AuthPanel {...props} />
    </div>
  </MotionConfig>
}
