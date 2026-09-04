"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  buildCatalogThemeCookie,
  CATALOG_THEME_STORAGE_KEY,
  getNextCatalogTheme,
  parseCatalogTheme,
  type CatalogTheme,
} from "@/lib/catalog-theme"

type CatalogThemeContextValue = {
  theme: CatalogTheme
  toggleTheme: () => void
}

const CatalogThemeContext = createContext<CatalogThemeContextValue | null>(null)

function persistCatalogTheme(theme: CatalogTheme) {
  try {
    window.localStorage.setItem(CATALOG_THEME_STORAGE_KEY, theme)
  } catch {
    // O cookie continua preservando a preferência quando o storage está indisponível.
  }

  document.cookie = buildCatalogThemeCookie(theme)
}

export function CatalogThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: CatalogTheme
  children: ReactNode
}) {
  const [theme, setTheme] = useState<CatalogTheme>(initialTheme)

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(CATALOG_THEME_STORAGE_KEY)
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme)
      }
    } catch {
      // A preferência entregue pelo servidor permanece como fonte válida.
    }
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CATALOG_THEME_STORAGE_KEY || !event.newValue) return
      setTheme(parseCatalogTheme(event.newValue))
    }

    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggleTheme = useCallback(() => {
    const nextTheme = getNextCatalogTheme(theme)
    setTheme(nextTheme)
    persistCatalogTheme(nextTheme)
  }, [theme])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <CatalogThemeContext.Provider value={value}>{children}</CatalogThemeContext.Provider>
}

export function useCatalogTheme() {
  const context = useContext(CatalogThemeContext)
  if (!context) throw new Error("useCatalogTheme must be used within CatalogThemeProvider")
  return context
}
