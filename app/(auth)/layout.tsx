import type { ReactNode } from "react"

import { EmeAuthExperience } from "@/components/eme/eme-auth-experience"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <EmeAuthExperience />
      <div className="hidden">{children}</div>
    </div>
  )
}
