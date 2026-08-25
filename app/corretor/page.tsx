import { BrokerPortal } from "@/components/broker-portal"

export default function BrokerPage() {
  const launchMode = process.env.COS_LAUNCH_MODE === "legacy" ? "legacy" : "simple"
  return <BrokerPortal launchMode={launchMode} />
}
