"use client"

import { useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

import { EmeExperience } from "@/components/eme/eme-experience"
import type { AuthMode } from "@/components/eme/auth-panel"
import { emeLandingTheme } from "@/lib/eme-theme"

function resolveAuthMode(pathname: string): AuthMode | null {
  if (pathname === "/login") return "login"
  if (pathname.startsWith("/cadastro")) return "signup"
  return null
}

function getAuthHref(mode: AuthMode) {
  return mode === "login" ? "/login" : "/cadastro"
}

export function EmeAuthExperience() {
  const pathname = usePathname()
  const router = useRouter()

  const authMode = resolveAuthMode(pathname)

  const handleAuthModeChange = useCallback(
    (mode: AuthMode) => {
      const href = getAuthHref(mode)

      if (pathname !== href) {
        router.push(href)
      }
    },
    [pathname, router],
  )

  const handleAuthClose = useCallback(() => {
    if (pathname !== "/") {
      router.push("/")
    }
  }, [pathname, router])

  return (
    <main className="relative overflow-x-clip bg-[var(--background)] text-[var(--foreground)]" style={emeLandingTheme}>
      <EmeExperience authMode={authMode} onAuthModeChange={handleAuthModeChange} onAuthClose={handleAuthClose} />
    </main>
  )
}
