import { BrokerMyPropertiesPage } from "@/components/broker-my-properties-page"

export default async function BrokerPropertyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BrokerMyPropertiesPage initialPropertyId={id} />
}
