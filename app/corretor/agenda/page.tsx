import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerAgendaPage } from "@/components/broker-agenda-page"

export default function AgendaPage() {
  return (
    <BrokerPageShell title="Agenda">
      <BrokerAgendaPage />
    </BrokerPageShell>
  )
}
