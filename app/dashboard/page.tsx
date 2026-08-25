import { BrokerPortal } from "@/components/broker-portal"
import { AuthSessionGuard } from "@/components/auth-session-guard"

export default function DashboardPage() {
  const launchMode = process.env.COS_LAUNCH_MODE === "legacy" ? "legacy" : "simple"
  return (
    <AuthSessionGuard allowedRole="BROKER">
      <BrokerPortal launchMode={launchMode} />
    </AuthSessionGuard>
  )
}
