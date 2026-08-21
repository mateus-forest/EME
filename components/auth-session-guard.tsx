"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  AuthSessionRequestError,
  clearLegacyAuthState,
  fetchCurrentUser,
  getDefaultRouteByRole,
  type AuthRole,
} from "@/lib/auth-client"
import { EmeLoading } from "@/components/ui/eme-loading"

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
  const [sessionError, setSessionError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function validateSession() {
      let user

      try {
        user = await fetchCurrentUser()
      } catch (error) {
        console.warn("[auth][guard] session check unavailable", {
          message: error instanceof Error ? error.message : "unknown",
          status: error instanceof AuthSessionRequestError ? error.status : null,
        })
        if (!cancelled) {
          setSessionError(
            error instanceof AuthSessionRequestError
              ? error.message
              : "Não foi possível validar sua sessão agora. Tente recarregar a página.",
          )
        }
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
      setSessionError("")
      setIsAuthorized(true)
    }

    void validateSession()

    return () => {
      cancelled = true
    }
  }, [allowedRole, pathname, router])

  if (!isAuthorized) {
    return (
      <EmeLoading
        message="Preparando seu EME"
        description={sessionError || "Verificando seu acesso..."}
      />
    )
  }

  return <>{children}</>
}
