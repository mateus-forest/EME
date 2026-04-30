"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { clearLegacyAuthState, fetchCurrentUser, getDefaultRouteByRole, type AuthRole } from "@/lib/auth-client"

export function AuthSessionGuard({
  allowedRole,
  children,
}: {
  allowedRole: AuthRole
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function validateSession() {
      let user

      try {
        user = await fetchCurrentUser()
      } catch (error) {
        console.error("[auth][guard] session check failed", {
          message: error instanceof Error ? error.message : "unknown",
        })
        return
      }

      if (cancelled) return

      if (!user) {
        clearLegacyAuthState()
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        return
      }

      if (user.role !== allowedRole) {
        router.replace(getDefaultRouteByRole(user.role))
        return
      }

      clearLegacyAuthState()
      setIsAuthorized(true)
    }

    void validateSession()

    return () => {
      cancelled = true
    }
  }, [allowedRole, pathname, router])

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0B] px-6 text-center text-sm text-white/55">
        Verificando acesso...
      </div>
    )
  }

  return <>{children}</>
}
