import type { CSSProperties } from "react"
import { Geist, Geist_Mono } from "next/font/google"

import { Catalog } from "@/components/v0-landing/catalog"
import { Clients } from "@/components/v0-landing/clients"
import { CreateFlow } from "@/components/v0-landing/create-flow"
import { Experiment } from "@/components/v0-landing/experiment"
import { FinalCta } from "@/components/v0-landing/final-cta"
import { Hero } from "@/components/v0-landing/hero"
import { Proposals } from "@/components/v0-landing/proposals"
import { ScreenGallery } from "@/components/v0-landing/screen-gallery"
import { SiteNav } from "@/components/v0-landing/site-nav"
import { StudioFlows } from "@/components/v0-landing/studio-flows"

const geist = Geist({
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

const landingTheme = {
  "--background": "oklch(0.995 0.003 145)",
  "--foreground": "oklch(0.17 0.02 155)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.17 0.02 155)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.17 0.02 155)",
  "--primary": "oklch(0.58 0.17 148)",
  "--primary-foreground": "oklch(0.99 0.01 145)",
  "--secondary": "oklch(0.97 0.01 150)",
  "--secondary-foreground": "oklch(0.24 0.03 155)",
  "--muted": "oklch(0.965 0.008 150)",
  "--muted-foreground": "oklch(0.52 0.02 155)",
  "--accent": "oklch(0.95 0.03 150)",
  "--accent-foreground": "oklch(0.32 0.08 150)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--destructive-foreground": "#ffffff",
  "--border": "oklch(0.92 0.008 150)",
  "--input": "oklch(0.92 0.008 150)",
  "--ring": "oklch(0.58 0.17 148)",
  "--brand-dark": "oklch(0.48 0.15 152)",
  "--brand": "oklch(0.58 0.18 148)",
  "--brand-light": "oklch(0.68 0.19 143)",
  "--radius": "0.75rem",
  colorScheme: "light",
} as CSSProperties

export default function Home() {
  return (
    <main
      className={`${geist.className} ${geistMono.variable} relative overflow-x-clip bg-[var(--background)] text-[var(--foreground)]`}
      style={landingTheme}
    >
      <SiteNav />
      <Hero />
      <ScreenGallery />
      <CreateFlow />
      <StudioFlows />
      <Clients />
      <Proposals />
      <Catalog />
      <Experiment />
      <FinalCta />
    </main>
  )
}
