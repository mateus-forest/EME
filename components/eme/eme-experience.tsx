"use client"

import { useEffect, useState } from "react"

import { EmeLandingScene } from "@/components/eme/eme-landing-scene"
import { EmeMobileExperience } from "@/components/eme/eme-mobile-experience"

export function EmeExperience() {
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

  return device === "mobile" ? <EmeMobileExperience /> : <EmeLandingScene />
}
