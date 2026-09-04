import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { CatalogThemeProvider } from "@/components/catalog-theme-provider"
import { CATALOG_THEME_COOKIE, parseCatalogTheme } from "@/lib/catalog-theme"
import "../imoveis/marketplace.css"

export default async function CatalogLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const initialTheme = parseCatalogTheme(cookieStore.get(CATALOG_THEME_COOKIE)?.value)

  return <CatalogThemeProvider initialTheme={initialTheme}>{children}</CatalogThemeProvider>
}
