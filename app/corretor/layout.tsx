import type { ReactNode } from "react"

import { AuthSessionGuard } from "@/components/auth-session-guard"

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthSessionGuard allowedRole="BROKER">
      <div className="broker-portal-scope min-h-[100dvh] w-full">{children}</div>
    </AuthSessionGuard>
  )
}
