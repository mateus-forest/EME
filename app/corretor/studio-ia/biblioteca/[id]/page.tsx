import { BrokerStudioIaLibraryDetailPage } from "@/components/broker-studio-ia-library-detail-page"

export default async function BrokerStudioIaLibraryDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <BrokerStudioIaLibraryDetailPage campaignId={id} />
}
