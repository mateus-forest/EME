import type { ReactNode } from "react"

import { AuthSessionGuard } from "@/components/auth-session-guard"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AuthSessionGuard allowedRole="ADMIN">{children}</AuthSessionGuard>
}
