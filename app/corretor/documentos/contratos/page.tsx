import { BrokerContractsExperience } from "@/components/broker-contracts-experience"
import { BrokerPageShell } from "@/components/broker-page-shell"

export default function ContractsPage() {
  return (
    <BrokerPageShell title="Documentos">
      <BrokerContractsExperience />
    </BrokerPageShell>
  )
}
