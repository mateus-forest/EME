"use client"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { installJourneyBrowser, trackJourney } from "@/lib/journey/browser"

export function JourneyTracker() {
  const pathname = usePathname()
  const previousPath = useRef<string | null>(null)
  useEffect(() => installJourneyBrowser(), [])
  useEffect(() => {
    if (!pathname || pathname === previousPath.current) return
    previousPath.current = pathname
    const search = new URLSearchParams(location.search)
    const metadata = { utmSource: search.get("utm_source")?.toLowerCase() ?? (document.referrer ? "other" : "direct"), utmMedium: search.get("utm_medium")?.toLowerCase() ?? "other" }
    trackJourney("page_view", { outcome: "viewed", metadata })
    if (pathname === "/") trackJourney("landing_view", { outcome: "viewed", metadata })
    if (pathname.startsWith("/imoveis")) trackJourney("marketplace_view", { module: "marketplace", outcome: "viewed" })
  }, [pathname])
  return null
}
