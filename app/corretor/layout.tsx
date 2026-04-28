import type { ReactNode } from "react"

import { AuthSessionGuard } from "@/components/auth-session-guard"

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return <AuthSessionGuard allowedRole="BROKER">{children}</AuthSessionGuard>
}
