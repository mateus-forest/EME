import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "EME — Seu talento. Outra velocidade.",
  description: "O ecossistema do corretor de imóveis. Mais tempo, alcance, agilidade, controle e clareza para o seu negócio.",
  // Keep the package's preview policy until publication is explicitly authorized.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: "#064c37" }

export default function Home() {
  return null
}
