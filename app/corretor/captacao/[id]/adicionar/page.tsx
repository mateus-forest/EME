import { BrokerCaptacaoInventory } from "@/components/broker-captacao-inventory"
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <BrokerCaptacaoInventory id={(await params).id} />
}
