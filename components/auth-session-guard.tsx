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
  const [retryCount, setRetryCount] = useState(0)

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
  }, [allowedRole, pathname, retryCount, router])

  if (!isAuthorized) {
    return (
      <EmeLoading
        message="Preparando seu EME"
        description={sessionError || "Verificando seu acesso..."}
        action={sessionError ? (
          <button
            type="button"
            onClick={() => {
              setSessionError("")
              setRetryCount((current) => current + 1)
            }}
            className="min-h-11 rounded-full border border-[#cbdccf] bg-white px-5 text-sm font-semibold text-[#173222] shadow-sm transition hover:bg-[#f7faf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17964c]/30"
          >
            Tentar novamente
          </button>
        ) : undefined}
      />
    )
  }

  return <>{children}</>
}
