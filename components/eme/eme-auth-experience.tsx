"use client"

import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { IntegratedLanding } from "@/components/eme/integrated-landing/integrated-landing"
import { AuthLoadingScreen, IntegratedAuthScreen, IntegratedRecoveryScreen } from "@/components/eme/integrated-auth/auth-screen"

export function EmeAuthExperience() {
  const pathname = usePathname()
  if (pathname === "/recuperar-senha") return <IntegratedRecoveryScreen />
  if (pathname === "/login") return <Suspense fallback={<AuthLoadingScreen mode="login" />}><IntegratedAuthScreen mode="login" /></Suspense>
  if (pathname.startsWith("/cadastro")) return <Suspense fallback={<AuthLoadingScreen mode="signup" />}><IntegratedAuthScreen mode="signup" /></Suspense>
  return <IntegratedLanding />
}
