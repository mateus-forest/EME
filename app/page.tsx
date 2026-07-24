import type { CSSProperties } from "react"

import { EmeExperience } from "@/components/eme/eme-experience"

const landingTheme = {
  "--eme": "oklch(0.62 0.16 148)",
  "--eme-dark": "oklch(0.5 0.15 150)",
  "--eme-soft": "oklch(0.95 0.03 150)",
  "--graphite": "oklch(0.45 0.01 260)",
  "--background": "oklch(0.98 0.004 150)",
  "--foreground": "oklch(0.2 0.01 260)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.145 0 0)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.145 0 0)",
  "--primary": "oklch(0.62 0.16 148)",
  "--primary-foreground": "oklch(0.99 0.01 150)",
  "--secondary": "oklch(0.97 0 0)",
  "--secondary-foreground": "oklch(0.205 0 0)",
  "--muted": "oklch(0.97 0 0)",
  "--muted-foreground": "oklch(0.556 0 0)",
  "--accent": "oklch(0.97 0 0)",
  "--accent-foreground": "oklch(0.205 0 0)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--border": "oklch(0.922 0 0)",
  "--input": "oklch(0.922 0 0)",
  "--ring": "oklch(0.708 0 0)",
  "--radius": "0.625rem",
  colorScheme: "light",
} as CSSProperties

export default function Home() {
  return (
    <main className="relative overflow-x-clip bg-[var(--background)] text-[var(--foreground)]" style={landingTheme}>
      <EmeExperience />
    </main>
  )
}
