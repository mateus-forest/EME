import { BrokerContractsPage } from "@/components/broker-contracts-page"
import { BrokerPageShell } from "@/components/broker-page-shell"

export default function ContractsPage() {
  return (
    <BrokerPageShell title="Documentos">
      <BrokerContractsPage />
    </BrokerPageShell>
  )
}
