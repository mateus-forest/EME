import type { AuthRole } from "./auth-client"

const INTERNAL_ORIGIN = "https://eme.invalid"
// eslint-disable-next-line no-control-regex -- Reject control characters before URL parsing can strip them.
const unsafeCharacters = /[\\\u0000-\u001f\u007f]/
const protectedRoots: Readonly<Record<string, AuthRole>> = {
  "/corretor": "BROKER",
  "/dashboard": "BROKER",
  "/admin": "ADMIN",
  "/corporativo": "AGENCY",
  "/imobiliaria": "AGENCY",
}

export function getDefaultRouteByRole(role: AuthRole) {
  if (role === "ADMIN") return "/admin"
  if (role === "AGENCY") return "/"
  return "/corretor"
}

/** Used before rendering login and again after authentication. No browser state. */
export function getInternalAuthDestination(value: unknown, role?: AuthRole): string | null {
  // Ambiguous duplicate parameters must not have different server/client meanings.
  if (Array.isArray(value)) value = value.length === 1 ? value[0] : null
  if (typeof value !== "string" || !value || value.length > 2048) return null
  if (value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || unsafeCharacters.test(value)) return null

  try {
    const url = new URL(value, INTERNAL_ORIGIN)
    if (url.origin !== INTERNAL_ORIGIN) return null

    // Reject encoded separators and nested encodings in the path. Query/hash
    // values are preserved: an encoded URL inside a filter is not a destination.
    if (/%(?:2f|5c|25|3f|23)/i.test(url.pathname)) return null
    const pathname = decodeURIComponent(url.pathname)
    if (unsafeCharacters.test(pathname) || pathname.includes("//")) return null
    const normalized = new URL(pathname, INTERNAL_ORIGIN)
    if (normalized.origin !== INTERNAL_ORIGIN) return null
    const root = `/${normalized.pathname.split("/")[1]}`
    const isPublic = normalized.pathname === "/" || root === "/imoveis" || root === "/catalogo"
    const requiredRole = protectedRoots[root]
    if (!isPublic && (!requiredRole || (role !== undefined && role !== requiredRole))) return null

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function resolveAuthRedirect(value: unknown, role: AuthRole): string {
  return getInternalAuthDestination(value, role) ?? getDefaultRouteByRole(role)
}
