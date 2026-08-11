import { BrokerStudioIaVideoPage } from "@/components/broker-studio-ia-video-page"

export default async function CorretorStudioIaVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ preparedAssetId?: string; preparedImageUrl?: string }>
}) {
  const params = await searchParams
  const id = params.preparedAssetId?.trim() ?? ""
  const imageUrl = params.preparedImageUrl?.trim() ?? ""
  const isHttpsImage = (() => {
    try {
      return new URL(imageUrl).protocol === "https:"
    } catch {
      return false
    }
  })()

  return (
    <BrokerStudioIaVideoPage
      initialPreparedAsset={id && isHttpsImage ? { id, imageUrl } : null}
    />
  )
}
