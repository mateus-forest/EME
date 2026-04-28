import { BrokerPortal } from "@/components/broker-portal"
import { AuthSessionGuard } from "@/components/auth-session-guard"

export default function DashboardPage() {
  return (
    <AuthSessionGuard allowedRole="BROKER">
      <BrokerPortal />
    </AuthSessionGuard>
  )
}
