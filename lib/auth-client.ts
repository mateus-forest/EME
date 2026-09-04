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

export class AuthSessionRequestError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(message, options)
    this.name = "AuthSessionRequestError"
    this.status = status
  }
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

let currentUserRequest: Promise<AuthenticatedUser | null> | null = null

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
  if (currentUserRequest) return currentUserRequest

  const request = (async () => {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }).catch((error: unknown) => {
      throw new AuthSessionRequestError(
        "Não foi possível conectar ao serviço de autenticação.",
        null,
        { cause: error },
      )
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return null

      throw new AuthSessionRequestError(
        "Não foi possível validar sua sessão agora. Tente recarregar a página.",
        response.status,
      )
    }

    const data = (await response.json()) as { user: AuthenticatedUser }
    return data.user
  })()

  currentUserRequest = request
  try {
    return await request
  } finally {
    if (currentUserRequest === request) currentUserRequest = null
  }
}
