"use client"

import { useEffect, useState } from "react"

import { EmeLandingScene } from "@/components/eme/eme-landing-scene"
import { EmeMobileExperience } from "@/components/eme/eme-mobile-experience"
import type { AuthMode } from "@/components/eme/auth-panel"

export function EmeExperience({
  authMode,
  onAuthModeChange,
  onAuthClose,
}: {
  authMode: AuthMode | null
  onAuthModeChange: (mode: AuthMode) => void
  onAuthClose: () => void
}) {
  const [device, setDevice] = useState<"desktop" | "mobile" | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () => setDevice(mq.matches ? "mobile" : "desktop")
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  if (device === null) {
    return <div className="h-[100svh] w-full bg-background" />
  }

  return device === "mobile" ? (
    <EmeMobileExperience authMode={authMode} onAuthModeChange={onAuthModeChange} onAuthClose={onAuthClose} />
  ) : (
    <EmeLandingScene authMode={authMode} onAuthModeChange={onAuthModeChange} onAuthClose={onAuthClose} />
  )
}
