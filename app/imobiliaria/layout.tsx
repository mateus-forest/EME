import type { ReactNode } from "react"

import { AuthSessionGuard } from "@/components/auth-session-guard"

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return <AuthSessionGuard allowedRole="AGENCY">{children}</AuthSessionGuard>
}
