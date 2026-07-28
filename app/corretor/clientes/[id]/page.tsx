import { BrokerClientsPage } from "@/components/broker-clients-page"

export default async function BrokerClientDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BrokerClientsPage initialClientId={id} />
}
