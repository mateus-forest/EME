import { BrokerAssistantPortal } from "@/components/broker-portal"

export default function BrokerCosPage() {
  const launchMode = process.env.COS_LAUNCH_MODE === "legacy" ? "legacy" : "simple"
  return <BrokerAssistantPortal launchMode={launchMode} />
}
