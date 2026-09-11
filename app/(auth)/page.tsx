import type { Metadata, Viewport } from "next"

// Vercel supplies this per deployment: local and Preview remain non-indexable.
// Do not promote a local/Preview build; build again in the Production environment.
const isProductionDeployment = process.env.VERCEL_ENV === "production"
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
const canonical = (() => {
  if (!isProductionDeployment || !appUrl) return undefined
  try {
    const url = new URL(appUrl)
    if (url.protocol !== "https:" || url.username || url.password || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return undefined
    return new URL("/", url).href
  } catch {
    return undefined
  }
})()

export const metadata: Metadata = {
  title: "EME — Uma estrutura. À sua altura.",
  description: "O ecossistema do corretor de imóveis. Mais tempo, alcance, agilidade, controle e clareza para o seu negócio.",
  robots: { index: isProductionDeployment, follow: isProductionDeployment },
  ...(canonical ? { alternates: { canonical } } : {}),
}

export const viewport: Viewport = { themeColor: "#064c37" }

export default function Home() {
  return null
}
