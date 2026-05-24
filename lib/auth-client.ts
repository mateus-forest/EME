export type AuthRole = "BROKER" | "AGENCY" | "ADMIN"

export type AuthenticatedUser = {
  id: string
  name: string
  email: string
  role: AuthRole
  accountType: "BROKER_INDEPENDENT" | "BROKER_AGENCY_LINKED" | "AGENCY" | "ADMIN"
  plan: "NONE" | "BROKER" | "AGENCY"
  subscriptionStatus: "INACTIVE" | "ACTIVE"
  brokerId: string | null
  agencyId: string | null
}

const LEGACY_AUTH_KEYS = [
  "eme-user-type",
  "eme-user-session",
  "userType",
  "mockUser",
  "currentPortal",
  "selectedProfile",
  "sessionRole",
  "authMode",
] as const

export function getDefaultRouteByRole(role: AuthRole) {
  if (role === "ADMIN") return "/admin"
  if (role === "AGENCY") return "/"
  return "/corretor"
}

export function clearLegacyAuthState() {
  if (typeof window === "undefined") return

  for (const key of LEGACY_AUTH_KEYS) {
    window.localStorage.removeItem(key)
  }
}

export async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  }).catch((error: unknown) => {
    throw error instanceof Error ? error : new Error("Não foi possível validar a sessão.")
  })

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error("Não foi possível validar a sessão agora.")
    }

    return null
  }

  const data = (await response.json()) as { user: AuthenticatedUser }
  return data.user
}
