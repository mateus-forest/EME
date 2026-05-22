import { NextResponse, type NextRequest } from "next/server"

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
