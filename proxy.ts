import { NextResponse, type NextRequest } from "next/server"
import { getInternalAuthDestination } from "./lib/auth-redirect"

const disabledPageRedirects = [
  { prefix: "/admin/imobiliarias", target: "/admin/corretores" },
  { prefix: "/cadastro/imobiliaria", target: "/cadastro/corretor" },
  { prefix: "/catalogo/imobiliaria", target: "/" },
  { prefix: "/corporativo", target: "/" },
  { prefix: "/imobiliaria", target: "/" },
] as const

const disabledApiPrefixes = [
  "/api/agencies",
  "/api/agency/brokers",
  "/api/properties/agency",
  "/api/catalogs/agency",
] as const

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (matchesPrefix(pathname, "/login") && request.nextUrl.searchParams.has("next")) {
    const values = request.nextUrl.searchParams.getAll("next")
    const destination = getInternalAuthDestination(values)
    if (!destination || destination !== values[0]) {
      const url = request.nextUrl.clone()
      url.searchParams.delete("next")
      if (destination) url.searchParams.set("next", destination)
      // Without a valid next, the client uses the authenticated role's default.
      return NextResponse.redirect(url)
    }
  }

  if (disabledApiPrefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
    return NextResponse.json(
      { error: "Fluxo de imobiliária indisponível no MVP do EME para corretores individuais." },
      { status: 410 },
    )
  }

  const pageRedirect = disabledPageRedirects.find((item) => matchesPrefix(pathname, item.prefix))
  if (pageRedirect) {
    const url = request.nextUrl.clone()
    url.pathname = pageRedirect.target
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/login/:path*",
    "/admin/imobiliarias",
    "/admin/imobiliarias/:path*",
    "/cadastro/imobiliaria",
    "/cadastro/imobiliaria/:path*",
    "/catalogo/imobiliaria",
    "/catalogo/imobiliaria/:path*",
    "/corporativo",
    "/corporativo/:path*",
    "/imobiliaria",
    "/imobiliaria/:path*",
    "/api/agencies",
    "/api/agencies/:path*",
    "/api/agency/brokers",
    "/api/agency/brokers/:path*",
    "/api/properties/agency",
    "/api/properties/agency/:path*",
    "/api/catalogs/agency",
    "/api/catalogs/agency/:path*",
  ],
}
