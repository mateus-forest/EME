import { BrokerDocumentsPage } from "@/components/broker-documents-page"
import { BrokerPageShell } from "@/components/broker-page-shell"

export default function DocumentsPage() {
  return (
    <BrokerPageShell title="Documentos">
      <BrokerDocumentsPage />
    </BrokerPageShell>
  )
}
