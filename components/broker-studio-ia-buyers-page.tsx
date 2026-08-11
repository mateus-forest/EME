"use client"
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  Megaphone,
  RefreshCcw,
  Users,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"

type StudioStep = "selection" | "configuration" | "processing" | "result" | "approval"
type AudienceProfile = "Primeiro imovel" | "Familia" | "Investidor" | "Alto padrao" | "Imovel de praia" | "Comercial"
type MainChannel = "Instagram" | "Facebook" | "Google" | "WhatsApp" | "Portais imobiliarios"
type StrategyBlockKey = "audience" | "strategy" | "copy" | "cta" | "timeline" | "reach" | "leads"

type BuyerStrategyPreview = {
  audience: string
  strategy: string
  copy: string
  cta: string
  timeline: string[]
  reach: string
  leads: string
}

type GenerationError = string | null
type CreditBlockState = {
  availableCredits: number
  requiredCredits: number
  ctaHref: string
  ctaLabel: string
} | null

const audienceOptions: AudienceProfile[] = ["Primeiro imovel", "Familia", "Investidor", "Alto padrao", "Imovel de praia", "Comercial"]
const channelOptions: MainChannel[] = ["Instagram", "Facebook", "Google", "WhatsApp", "Portais imobiliarios"]

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Seleção" },
  { id: "configuration", label: "Configuração" },
  { id: "processing", label: "Processamento" },
  { id: "result", label: "Resultado" },
  { id: "approval", label: "Aprovação" },
]

export function BrokerStudioIaBuyersPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedAudience, setSelectedAudience] = useState<AudienceProfile>("Primeiro imovel")
  const [selectedChannel, setSelectedChannel] = useState<MainChannel>("Instagram")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preview, setPreview] = useState<BuyerStrategyPreview | null>(null)
  const [generationError, setGenerationError] = useState<GenerationError>(null)
  const [creditBlock, setCreditBlock] = useState<CreditBlockState>(null)
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [approvedBlocks, setApprovedBlocks] = useState<Record<StrategyBlockKey, boolean>>({
    audience: false,
    strategy: false,
    copy: false,
    cta: false,
    timeline: false,
    reach: false,
    leads: false,
  })

  const propertyOptions = useMemo(() => properties, [properties])
  const selectedProperty = useMemo(
    () => propertyOptions.find((property) => property.id === selectedPropertyId) ?? null,
    [propertyOptions, selectedPropertyId],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedPropertyId && propertyOptions[0]) {
      setSelectedPropertyId(propertyOptions[0].id)
    }
  }, [propertyOptions, selectedPropertyId])

  useEffect(() => {
    if (!selectedPropertyId) return
    let ignore = false

    studioCampaignsClient
      .getLatest("BUYERS", selectedPropertyId)
      .then((storedCampaign) => {
        if (!storedCampaign || ignore) return
        applyStoredCampaign(storedCampaign)
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [selectedPropertyId])

  const canAdvanceToConfiguration = Boolean(selectedProperty)
  const canProcess = Boolean(selectedProperty) && !isSubmitting
  const approvedBlocksCount = Object.values(approvedBlocks).filter(Boolean).length

  function buildApprovalMap(storedCampaign: StudioCampaignRecord) {
    return {
      audience: storedCampaign.assets.find((asset) => asset.assetKey === "audience")?.status === "APPROVED",
      strategy: storedCampaign.assets.find((asset) => asset.assetKey === "strategy")?.status === "APPROVED",
      copy: storedCampaign.assets.find((asset) => asset.assetKey === "copy")?.status === "APPROVED",
      cta: storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.status === "APPROVED",
      timeline: storedCampaign.assets.find((asset) => asset.assetKey === "timeline")?.status === "APPROVED",
      reach: storedCampaign.assets.find((asset) => asset.assetKey === "reach")?.status === "APPROVED",
      leads: storedCampaign.assets.find((asset) => asset.assetKey === "leads")?.status === "APPROVED",
    }
  }

  function applyStoredCampaign(storedCampaign: StudioCampaignRecord) {
    const nextPreview = {
      audience: (storedCampaign.assets.find((asset) => asset.assetKey === "audience")?.content as string) ?? "",
      strategy: (storedCampaign.assets.find((asset) => asset.assetKey === "strategy")?.content as string) ?? "",
      copy: (storedCampaign.assets.find((asset) => asset.assetKey === "copy")?.content as string) ?? "",
      cta: (storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.content as string) ?? "",
      timeline: (storedCampaign.assets.find((asset) => asset.assetKey === "timeline")?.content as string[]) ?? [],
      reach: (storedCampaign.assets.find((asset) => asset.assetKey === "reach")?.content as string) ?? "",
      leads: (storedCampaign.assets.find((asset) => asset.assetKey === "leads")?.content as string) ?? "",
    }

    if (nextPreview.audience) setPreview(nextPreview)
    setCampaign(storedCampaign)
    if (storedCampaign.goal) setSelectedAudience(storedCampaign.goal as AudienceProfile)
    if (storedCampaign.visualIdentity) setSelectedChannel(storedCampaign.visualIdentity as MainChannel)
    setResultVersion(storedCampaign.version)
    setApprovedVersion(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? storedCampaign.version : null)
    setApprovedBlocks(buildApprovalMap(storedCampaign))
    setCurrentStep(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? "approval" : "result")
  }

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    resetResultState()
    setCurrentStep("selection")
  }

  function goToConfiguration() {
    if (!canAdvanceToConfiguration) return
    setCurrentStep("configuration")
  }

  async function startProcessing() {
    if (!canProcess) return
    const nextVersion = resultVersion + 1
    await requestStrategyGeneration(nextVersion)
  }

  async function requestStrategyGeneration(nextVersion: number) {
    if (!selectedProperty) return

    setGenerationError(null)
    setCreditBlock(null)
    setIsSubmitting(true)
    setCurrentStep("processing")

    try {
      const response = await fetch("/api/studio-ia/buyers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          audience: selectedAudience,
          channel: selectedChannel,
          version: nextVersion,
        }),
      })

      const data = (await response.json().catch(() => null)) as (BuyerStrategyPreview & {
        error?: string
        campaign?: StudioCampaignRecord
        creditsBlocked?: boolean
        availableCredits?: number
        requiredCredits?: number
        ctaHref?: string
        ctaLabel?: string
      }) | null

      if (!response.ok || !data) {
        if (data?.creditsBlocked) {
          setCreditBlock({
            availableCredits: data.availableCredits ?? 0,
            requiredCredits: data.requiredCredits ?? 0,
            ctaHref: data.ctaHref || "/corretor/plano",
            ctaLabel: data.ctaLabel || "Ver plano",
          })
        }
        throw new Error(data?.error || "Não foi possível gerar a estratégia para atrair compradores.")
      }

      setPreview({
        audience: data.audience,
        strategy: data.strategy,
        copy: data.copy,
        cta: data.cta,
        timeline: data.timeline,
        reach: data.reach,
        leads: data.leads,
      })
      if (data.campaign) setCampaign(data.campaign)
      setResultVersion(nextVersion)
      setApprovedVersion(null)
      setApprovedBlocks({
        audience: false,
        strategy: false,
        copy: false,
        cta: false,
        timeline: false,
        reach: false,
        leads: false,
      })
      setCurrentStep("result")
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível gerar a estratégia.")
      setCurrentStep("configuration")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleBlockApproval(block: StrategyBlockKey) {
    if (!campaign) return
    const asset = campaign.assets.find((entry) => entry.assetKey === block)
    if (!asset) return

    const nextCampaign = await studioCampaignsClient.updateAssetStatus(
      asset.id,
      approvedBlocks[block] ? "PENDING_REVIEW" : "APPROVED",
    )
    applyStoredCampaign(nextCampaign)
  }

  async function approveStrategy() {
    if (!campaign || !resultVersion) return
    const nextCampaign = await studioCampaignsClient.approveCampaign(campaign.id)
    applyStoredCampaign(nextCampaign)
  }

  async function generateAnotherVersion() {
    if (!canProcess) return
    setApprovedVersion(null)
    await requestStrategyGeneration(resultVersion + 1)
  }

  function restartFlow() {
    resetResultState()
    setCurrentStep("selection")
  }

  function resetResultState() {
    setCampaign(null)
    setResultVersion(0)
    setApprovedVersion(null)
    setPreview(null)
    setGenerationError(null)
    setApprovedBlocks({
      audience: false,
      strategy: false,
      copy: false,
      cta: false,
      timeline: false,
      reach: false,
      leads: false,
    })
    setIsSubmitting(false)
  }

  const visualSummary = useMemo(
    () => [
      { label: "Público", value: selectedAudience },
      { label: "Canal principal", value: selectedChannel },
      { label: "Versão", value: resultVersion > 0 ? `${resultVersion}` : "Ainda não gerada" },
    ],
    [resultVersion, selectedAudience, selectedChannel],
  )

  const coverImage = selectedProperty?.images[0] ?? ""

  return (
    <BrokerPageShell title="Studio IA">
      <div className="min-w-0 grid gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Users className="size-3.5" />
                Fluxo Studio IA
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Criar anúncio</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Crie materiais e mensagens focados em promover um imóvel e gerar oportunidades.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                <Link href="/corretor/studio-ia">
                  <ChevronLeft className="size-4" />
                  Voltar para Studio IA
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="studio-step-grid">
          {stepLabels.map((step, index) => {
            const isActive = step.id === currentStep
            const isComplete = stepOrder(step.id) < stepOrder(currentStep)

            return (
              <div
                key={step.id}
                className={`rounded-[1.15rem] border px-4 py-3 text-sm ${isActive ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : isComplete ? "border-black/[0.06] bg-white text-[#050505]" : "border-black/[0.06] bg-[#fbfbf8] text-[#7B8491]"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${isActive ? "bg-[#009b3a] text-white" : isComplete ? "bg-[#050505] text-white" : "bg-white text-[#7B8491]"}`}>
                    {isComplete ? <CheckCircle2 className="size-3.5" /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </div>
              </div>
            )
          })}
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Fluxo visual</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                O Studio reaproveita a mesma experiência em etapas e agora gera o conteúdo real no servidor para este fluxo.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Megaphone className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Criar anúncio</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      Organize público, canal e mensagem principal para gerar uma estratégia comercial real do imóvel.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">1. Selecionar imóvel</p>
                    <span className="text-xs text-[#7B8491]">{propertyOptions.length} disponível(is)</span>
                  </div>

                  {isLoading ? (
                    <EmeLoading compact message="Carregando imóveis do corretor..." className="mt-3" />
                  ) : propertyOptions.length > 0 ? (
                    <div className="mt-3 grid gap-3">
                      <select
                        value={selectedPropertyId}
                        onChange={(event) => handlePropertyChange(event.target.value)}
                        className="h-11 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#050505] outline-none focus:ring-2 focus:ring-[#009b3a]/25"
                      >
                        {propertyOptions.map((property) => (
                          <option key={property.id} value={property.id}>
                            {property.title} - {property.city}
                          </option>
                        ))}
                      </select>

                      {selectedProperty ? (
                        <div className="overflow-hidden rounded-[1.15rem] border border-black/[0.06] bg-white">
                          <div className="grid gap-0 lg:grid-cols-[12rem_minmax(0,1fr)]">
                            <div className="relative aspect-[4/3] bg-[#f2f4f7]">
                              {selectedProperty.images[0] ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={selectedProperty.images[0]} alt={selectedProperty.title} className="h-full w-full object-cover" />
                                </>
                              ) : (
                                <div className="flex h-full items-center justify-center text-[#98A2B3]">
                                  <ImagePlus className="size-6" />
                                </div>
                              )}
                            </div>
                            <div className="grid gap-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-[#050505]">{selectedProperty.title}</p>
                                  <p className="mt-1 text-sm text-[#6B7280]">{selectedProperty.location}</p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${selectedProperty.status === "Publicado" ? "bg-[#eef9f1] text-[#009b3a]" : "bg-[#f2f4f7] text-[#667085]"}`}>
                                  {selectedProperty.status}
                                </span>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <InfoTile label="Valor" value={selectedProperty.price} />
                                <InfoTile label="Localização" value={`${selectedProperty.neighborhood}, ${selectedProperty.city}`} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        onClick={goToConfiguration}
                        disabled={!canAdvanceToConfiguration}
                        className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                      >
                        Avançar para configuração
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <EmptyPropertiesState />
                  )}
                </div>

                <div className={`rounded-[1.25rem] border p-4 ${currentStep === "selection" ? "border-black/[0.06] bg-[#f6f7f4] opacity-65" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">2. Configuração</p>

                  {selectedProperty ? (
                    <div className="mt-3 grid gap-4">
                      <div>
                        <p className="text-sm font-medium text-[#050505]">Escolha o perfil do público</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {audienceOptions.map((audience) => (
                            <button
                              key={audience}
                              type="button"
                              onClick={() => setSelectedAudience(audience)}
                              className={`rounded-full border px-4 py-2 text-sm transition-colors ${selectedAudience === audience ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                            >
                              {audience}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-[#050505]">Escolha o canal principal</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {channelOptions.map((channel) => (
                            <button
                              key={channel}
                              type="button"
                              onClick={() => setSelectedChannel(channel)}
                              className={`rounded-full border px-4 py-2 text-sm transition-colors ${selectedChannel === channel ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                            >
                              {channel}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={startProcessing}
                        disabled={!canProcess}
                        className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                      >
                        {isSubmitting ? "Gerando estratégia" : "Gerar estratégia"}
                        <ArrowRight className="size-4" />
                      </Button>
                      <p className="text-sm text-[#6B7280]">Consome 3 Créditos IA por execução.</p>
                      {generationError ? (
                        <p className="text-sm text-[#D14343]">{generationError}</p>
                      ) : null}
                      {creditBlock ? (
                        <Button asChild variant="ghost" className="h-9 w-fit rounded-xl border border-black/[0.06] bg-white px-3 text-[#4B5563] hover:bg-white hover:text-[#050505]">
                          <Link href={creditBlock.ctaHref}>{creditBlock.ctaLabel}</Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#6B7280]">Escolha um imóvel primeiro para liberar a configuração.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Resumo do fluxo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              {visualSummary.map((item) => (
                <div key={item.label} className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-[#050505]">{item.value}</p>
                </div>
              ))}

              <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Aprovações da estratégia</p>
                <p className="mt-2 text-sm font-semibold text-[#050505]">{approvedBlocksCount} de 7 blocos revisados</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  Cada bloco da estratégia pode ser aprovado individualmente para manter o mesmo padrão de revisão do Studio IA.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Resultado e aprovação</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Revise a estratégia gerada, aprove cada bloco e finalize a versão quando estiver pronta.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              {currentStep === "processing" ? (
                <EmeLoading
                  message="Gerando estratégia com IA"
                  description={`Montando a estratégia para ${selectedAudience.toLowerCase()} com foco principal em ${selectedChannel.toLowerCase()}.`}
                  className="min-h-[22rem] border border-[#009b3a]/18 bg-[#eef9f1]"
                />
              ) : currentStep === "result" || currentStep === "approval" ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <PreviewCard
                      title="Público recomendado"
                      approved={approvedBlocks.audience}
                      onApprove={() => toggleBlockApproval("audience")}
                      content={
                        <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                              <Users className="size-4.5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#050505]">{preview?.audience}</p>
                              <p className="mt-1 text-sm text-[#6B7280]">Perfil sugerido para o imóvel selecionado.</p>
                            </div>
                          </div>
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Estratégia sugerida"
                      approved={approvedBlocks.strategy}
                      onApprove={() => toggleBlockApproval("strategy")}
                      content={<p className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4 text-sm leading-6 text-[#5F6B7A]">{preview?.strategy}</p>}
                    />

                    <PreviewCard
                      title="Texto principal"
                      approved={approvedBlocks.copy}
                      onApprove={() => toggleBlockApproval("copy")}
                      content={
                        <div className="overflow-hidden rounded-[1.2rem] border border-black/[0.06] bg-white">
                          <div className="relative aspect-[4/3] bg-[#dfe8df]">
                            {coverImage ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={coverImage} alt="Preview da estratégia" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                              </>
                            ) : null}
                            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/80">{selectedChannel}</p>
                              <p className="mt-2 text-lg font-semibold">{selectedProperty?.title}</p>
                            </div>
                          </div>
                          <div className="px-4 py-3 text-sm leading-6 text-[#5F6B7A]">{preview?.copy}</div>
                        </div>
                      }
                    />

                    <PreviewCard
                      title="CTA"
                      approved={approvedBlocks.cta}
                      onApprove={() => toggleBlockApproval("cta")}
                      content={
                        <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                          <div className="inline-flex rounded-full bg-[#009b3a] px-4 py-2 text-sm font-semibold text-white">
                            {preview?.cta}
                          </div>
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Cronograma de divulgação"
                      approved={approvedBlocks.timeline}
                      onApprove={() => toggleBlockApproval("timeline")}
                      content={
                        <div className="grid gap-3">
                          {preview?.timeline.map((item, index) => (
                            <div key={`${item}-${index}`} className="rounded-[1rem] border border-black/[0.06] bg-white p-4">
                              <span className="rounded-full bg-[#eef9f1] px-2.5 py-1 text-[11px] font-medium text-[#009b3a]">
                                Etapa {index + 1}
                              </span>
                              <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">{item}</p>
                            </div>
                          ))}
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Estimativa de alcance"
                      approved={approvedBlocks.reach}
                      onApprove={() => toggleBlockApproval("reach")}
                      content={<MetricPreview value={preview?.reach ?? "--"} description="Estimativa simulada de alcance potencial no canal principal." />}
                    />

                    <PreviewCard
                      title="Estimativa de geração de leads"
                      approved={approvedBlocks.leads}
                      onApprove={() => toggleBlockApproval("leads")}
                      content={<MetricPreview value={preview?.leads ?? "--"} description="Estimativa simulada de interessados qualificados gerados pela estratégia." />}
                    />
                  </div>

                  <div className={`rounded-[1.25rem] border p-4 ${currentStep === "approval" ? "border-[#009b3a]/22 bg-[#eef9f1]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-[#050505]">
                          {currentStep === "approval" ? "Estratégia aprovada com sucesso" : "Estratégia pronta para revisão"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {currentStep === "approval"
                            ? `A estratégia versão ${approvedVersion ?? resultVersion} foi aprovada para ${selectedAudience.toLowerCase()} no canal ${selectedChannel.toLowerCase()}.`
                            : "Revise os blocos da estratégia, aprove os itens desejados e finalize ou gere outra versão."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentStep !== "approval" ? (
                          <>
                            <Button
                              type="button"
                              onClick={approveStrategy}
                              className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]"
                            >
                              Aprovar estratégia
                              <CheckCircle2 className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={generateAnotherVersion}
                              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                            >
                              Gerar nova versão
                              <RefreshCcw className="size-4" />
                            </Button>
                            <Button
                              asChild
                              type="button"
                              variant="ghost"
                              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                            >
                              <Link href="/corretor/studio-ia">
                                Voltar ao Studio IA
                              </Link>
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={generateAnotherVersion}
                              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                            >
                              Gerar nova versão
                              <RefreshCcw className="size-4" />
                            </Button>
                            <Button
                              asChild
                              type="button"
                              variant="ghost"
                              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                            >
                              <Link href="/corretor/studio-ia">
                                Voltar ao Studio IA
                              </Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-6 text-center">
                  <ImagePlus className="size-8 text-[#8B95A1]" />
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Nenhuma estratégia gerada ainda</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7280]">
                    Avance pelas etapas de seleção e configuração para iniciar a geração desta estratégia.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Estado atual</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              {buildStatusItems(currentStep).map((item) => (
                <div key={item.title} className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{item.title}</p>
                  <p className="mt-2 text-sm font-semibold text-[#050505]">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">{item.description}</p>
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                onClick={restartFlow}
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                Reiniciar fluxo
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </BrokerPageShell>
  )
}

function PreviewCard({
  title,
  approved,
  onApprove,
  content,
}: {
  title: string
  approved: boolean
  onApprove: () => void
  content: ReactNode
}) {
  return (
    <div className="rounded-[1.35rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#050505]">{title}</p>
        <Button
          type="button"
          variant={approved ? "default" : "ghost"}
          onClick={onApprove}
          className={approved
            ? "h-9 rounded-xl bg-[#009b3a] px-3 text-sm font-semibold text-white hover:bg-[#008633]"
            : "h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"}
        >
          {approved ? "Aprovado" : "Aprovar"}
        </Button>
      </div>
      {content}
    </div>
  )
}

function MetricPreview({ value, description }: { value: string; description: string }) {
  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
      <p className="text-2xl font-semibold text-[#050505]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#050505]">{value}</p>
    </div>
  )
}

function stepOrder(step: StudioStep) {
  if (step === "selection") return 0
  if (step === "configuration") return 1
  if (step === "processing") return 2
  if (step === "result") return 3
  return 4
}

function buildStatusItems(step: StudioStep) {
  return [
    {
      title: "Etapa atual",
      value:
        step === "selection"
          ? "Seleção"
          : step === "configuration"
            ? "Configuração"
            : step === "processing"
              ? "Geração com IA"
              : step === "result"
                ? "Resultado"
                : "Aprovação",
      description: "O Studio reaproveita a mesma jornada por etapas para manter consistência e permitir novas versões da estratégia.",
    },
    {
      title: "Integrações",
      value: "Processamento interno",
      description: "Este fluxo gera a estratégia real no servidor sem expor configurações técnicas ao corretor.",
    },
    {
      title: "Persistência",
      value: "Sem alterar banco",
      description: "As aprovações e versões desta estratégia continuam apenas na sessão atual, preservando a arquitetura do portal.",
    },
  ]
}

function EmptyPropertiesState() {
  return (
    <div className="mt-3 rounded-[1.15rem] border border-dashed border-black/[0.08] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-[#fbfbf8] text-[#8B95A1]">
          <ImagePlus className="size-4.5" />
        </div>
        <div>
          <p className="font-semibold text-[#050505]">Nenhum imóvel disponível</p>
          <p className="mt-1 text-sm leading-6 text-[#6B7280]">
            Cadastre ou publique um imóvel para iniciar este fluxo do Studio IA.
          </p>
          <Button asChild className="mt-3 h-9 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]">
            <Link href="/corretor/novo-imovel">Cadastrar imóvel</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
