"use client"
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Home,
  ImagePlus,
  Instagram,
  PlayCircle,
  Sparkles,
  Video,
  Users,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"
import { formatCountLabel } from "@/lib/structured-fields"

type StudioStep = "selection" | "checklist" | "operation" | "readiness"
type CommercialFlowKey = "construction" | "instagram" | "video" | "buyers" | "owners"
type PlanBlockKey = "strategy" | "audience" | "campaign" | "caption" | "cta" | "whatsapp" | "timeline" | "nextActions"

type SellPropertyPlan = {
  salesStrategy: string
  recommendedAudience: string
  mainCampaign: string
  caption: string
  cta: string
  whatsappText: string
  timeline: string[]
  nextActions: string[]
  applicableFlows: string[]
}

type CommercialFlow = {
  key: CommercialFlowKey
  title: string
  description: string
  href?: string
  icon: typeof Home
  isAvailable: boolean
}

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Seleção" },
  { id: "checklist", label: "Checklist" },
  { id: "operation", label: "Central" },
  { id: "readiness", label: "Pronto" },
]

const commercialFlows: CommercialFlow[] = [
  {
    key: "construction",
    title: "Transformar obra em imóvel pronto",
    description: "Prepare a imagem comercial final quando o ativo ainda estiver em obra.",
    href: "/corretor/studio-ia/transformar-obra-em-imovel-pronto",
    icon: Sparkles,
    isAvailable: true,
  },
  {
    key: "instagram",
    title: "Criar campanha para Instagram",
    description: "Organize feed, story, carrossel, legenda, CTA e hashtags do imóvel.",
    href: "/corretor/studio-ia/criar-campanha-instagram",
    icon: Instagram,
    isAvailable: true,
  },
  {
    key: "video",
    title: "Criar vídeo do imóvel",
    description: "Estruture a frente audiovisual da divulgação comercial.",
    href: "/corretor/studio-ia/criar-video-do-imovel",
    icon: Video,
    isAvailable: true,
  },
  {
    key: "buyers",
    title: "Atrair compradores",
    description: "Planeje a captação de demanda para acelerar a operação comercial.",
    href: "/corretor/studio-ia/atrair-compradores",
    icon: Users,
    isAvailable: true,
  },
  {
    key: "owners",
    title: "Captar proprietários",
    description: "Amplie o potencial comercial do corretor com novos ativos e relacionamento.",
    href: "/corretor/studio-ia/captar-proprietarios",
    icon: Home,
    isAvailable: true,
  },
]

export function BrokerStudioIaSellPropertyPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [plan, setPlan] = useState<SellPropertyPlan | null>(null)
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [completedFlows, setCompletedFlows] = useState<Record<CommercialFlowKey, boolean>>({
    construction: false,
    instagram: false,
    video: false,
    buyers: false,
    owners: false,
  })
  const [approvedBlocks, setApprovedBlocks] = useState<Record<PlanBlockKey, boolean>>({
    strategy: false,
    audience: false,
    campaign: false,
    caption: false,
    cta: false,
    whatsapp: false,
    timeline: false,
    nextActions: false,
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
      .getLatest("SELL_PROPERTY", selectedPropertyId)
      .then((storedCampaign) => {
        if (!storedCampaign || ignore) return
        applyStoredCampaign(storedCampaign)
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [selectedPropertyId])

  const availableFlows = useMemo(
    () => commercialFlows.filter((flow) => flow.isAvailable),
    [],
  )

  const availableCompletedCount = availableFlows.filter((flow) => completedFlows[flow.key]).length
  const pendingFlowsCount = commercialFlows.filter((flow) => !completedFlows[flow.key]).length
  const approvedBlocksCount = Object.values(approvedBlocks).filter(Boolean).length
  const isReadyForOperation = availableCompletedCount === availableFlows.length && approvedVersion === resultVersion && resultVersion > 0

  function buildApprovalMap(storedCampaign: StudioCampaignRecord) {
    return {
      strategy: storedCampaign.assets.find((asset) => asset.assetKey === "strategy")?.status === "APPROVED",
      audience: storedCampaign.assets.find((asset) => asset.assetKey === "audience")?.status === "APPROVED",
      campaign: storedCampaign.assets.find((asset) => asset.assetKey === "campaign")?.status === "APPROVED",
      caption: storedCampaign.assets.find((asset) => asset.assetKey === "caption")?.status === "APPROVED",
      cta: storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.status === "APPROVED",
      whatsapp: storedCampaign.assets.find((asset) => asset.assetKey === "whatsapp")?.status === "APPROVED",
      timeline: storedCampaign.assets.find((asset) => asset.assetKey === "timeline")?.status === "APPROVED",
      nextActions: storedCampaign.assets.find((asset) => asset.assetKey === "next_actions")?.status === "APPROVED",
    }
  }

  function applyStoredCampaign(storedCampaign: StudioCampaignRecord) {
    const metadata = (storedCampaign.metadata ?? {}) as { applicableFlows?: string[] }
    const nextPlan = {
      salesStrategy: (storedCampaign.assets.find((asset) => asset.assetKey === "strategy")?.content as string) ?? "",
      recommendedAudience: (storedCampaign.assets.find((asset) => asset.assetKey === "audience")?.content as string) ?? "",
      mainCampaign: (storedCampaign.assets.find((asset) => asset.assetKey === "campaign")?.content as string) ?? "",
      caption: (storedCampaign.assets.find((asset) => asset.assetKey === "caption")?.content as string) ?? "",
      cta: (storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.content as string) ?? "",
      whatsappText: (storedCampaign.assets.find((asset) => asset.assetKey === "whatsapp")?.content as string) ?? "",
      timeline: (storedCampaign.assets.find((asset) => asset.assetKey === "timeline")?.content as string[]) ?? [],
      nextActions: (storedCampaign.assets.find((asset) => asset.assetKey === "next_actions")?.content as string[]) ?? [],
      applicableFlows: metadata.applicableFlows ?? [],
    }
    if (nextPlan.salesStrategy) setPlan(nextPlan)
    setCampaign(storedCampaign)
    setResultVersion(storedCampaign.version)
    setApprovedVersion(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? storedCampaign.version : null)
    setApprovedBlocks(buildApprovalMap(storedCampaign))
    setCurrentStep(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? "readiness" : "operation")
  }

  const visualSummary = useMemo(
    () => [
      {
        label: "Imóvel selecionado",
        value: selectedProperty?.title ?? "Nenhum imóvel selecionado",
      },
      {
        label: "Fluxos concluídos",
        value: `${availableCompletedCount} de ${availableFlows.length} disponíveis`,
      },
      {
        label: "Última atualização",
        value: approvedVersion ? `Versão ${approvedVersion} aprovada` : buildLastUpdateLabel(availableCompletedCount),
      },
    ],
    [approvedVersion, availableCompletedCount, availableFlows.length, selectedProperty],
  )

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    restartFlow()
  }

  function toggleFlowCompletion(flowKey: CommercialFlowKey) {
    setCompletedFlows((current) => ({
      ...current,
      [flowKey]: !current[flowKey],
    }))
  }

  async function togglePlanBlock(block: PlanBlockKey) {
    if (!campaign) return
    const assetKey = block === "nextActions" ? "next_actions" : block
    const asset = campaign.assets.find((entry) => entry.assetKey === assetKey)
    if (!asset) return
    const nextCampaign = await studioCampaignsClient.updateAssetStatus(
      asset.id,
      approvedBlocks[block] ? "PENDING_REVIEW" : "APPROVED",
    )
    applyStoredCampaign(nextCampaign)
  }

  async function generateCommercialPlan(nextVersion: number) {
    if (!selectedProperty) return

    setGenerationError(null)
    setIsSubmitting(true)
    setCurrentStep("operation")

    try {
      const response = await fetch("/api/studio-ia/sell-property", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          version: nextVersion,
        }),
      })

      const data = (await response.json().catch(() => null)) as (SellPropertyPlan & { error?: string; campaign?: StudioCampaignRecord }) | null

      if (!response.ok || !data) {
        throw new Error(data?.error || "Nao foi possivel gerar o plano comercial consolidado.")
      }

      setPlan({
        salesStrategy: data.salesStrategy,
        recommendedAudience: data.recommendedAudience,
        mainCampaign: data.mainCampaign,
        caption: data.caption,
        cta: data.cta,
        whatsappText: data.whatsappText,
        timeline: data.timeline,
        nextActions: data.nextActions,
        applicableFlows: data.applicableFlows,
      })
      if (data.campaign) setCampaign(data.campaign)
      setResultVersion(nextVersion)
      setApprovedVersion(null)
      setApprovedBlocks({
        strategy: false,
        audience: false,
        campaign: false,
        caption: false,
        cta: false,
        whatsapp: false,
        timeline: false,
        nextActions: false,
      })
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel gerar o plano comercial.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function startCommercialPlan() {
    if (!selectedProperty) return
    await generateCommercialPlan(resultVersion + 1)
  }

  async function generateAnotherVersion() {
    if (!selectedProperty || isSubmitting) return
    await generateCommercialPlan(resultVersion + 1)
  }

  async function approvePlan() {
    if (!campaign || !plan || !resultVersion) return
    const nextCampaign = await studioCampaignsClient.approveCampaign(campaign.id)
    applyStoredCampaign(nextCampaign)
  }

  function restartFlow() {
    setCampaign(null)
    setCompletedFlows({
      construction: false,
      instagram: false,
      video: false,
      buyers: false,
      owners: false,
    })
    setApprovedBlocks({
      strategy: false,
      audience: false,
      campaign: false,
      caption: false,
      cta: false,
      whatsapp: false,
      timeline: false,
      nextActions: false,
    })
    setPlan(null)
    setGenerationError(null)
    setIsSubmitting(false)
    setResultVersion(0)
    setApprovedVersion(null)
    setCurrentStep("selection")
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="min-w-0 grid gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <PlayCircle className="size-3.5" />
                Orquestrador Studio IA
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Vender este imóvel</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Centralize a preparação comercial do imóvel, acompanhe os fluxos disponíveis e gere um plano comercial consolidado antes de iniciar a divulgação.
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

        <section className="grid gap-2 md:grid-cols-4">
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
                O Studio organiza a venda do imóvel em uma trilha única e agora consolida o plano comercial real no servidor.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Home className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Vender este imóvel</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      Centralize todos os materiais e fluxos essenciais para preparar a operação comercial do ativo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">1. Selecionar imóvel</p>
                  <span className="text-xs text-[#7B8491]">{formatCountLabel(propertyOptions.length, "imóvel disponível", "imóveis disponíveis")}</span>
                </div>

                {isLoading ? (
                  <EmeLoading compact message="Carregando imóveis do corretor..." className="mt-3" />
                ) : propertyOptions.length > 0 ? (
                  <div className="mt-3 grid gap-3">
                    <select
                      aria-label="Imóvel para plano comercial"
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
                              <InfoTile label="Endereço" value={`${selectedProperty.neighborhood}, ${selectedProperty.city}`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      onClick={() => setCurrentStep("checklist")}
                      disabled={!selectedProperty}
                      className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                    >
                      Avançar para checklist
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <EmptyPropertiesState />
                )}
              </div>

              <div className={`rounded-[1.25rem] border p-4 ${currentStep === "selection" ? "border-black/[0.06] bg-[#f6f7f4] opacity-65" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">2. Checklist de preparação comercial</p>
                  <span className="text-xs text-[#7B8491]">{availableCompletedCount} concluído(s)</span>
                </div>

                <div className="mt-3 grid gap-3">
                  {commercialFlows.map((flow) => (
                    <CommercialActionCard
                      key={flow.key}
                      flow={flow}
                      completed={completedFlows[flow.key]}
                      onToggleComplete={() => toggleFlowCompletion(flow.key)}
                    />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep("operation")}
                    disabled={!selectedProperty}
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                  >
                    Abrir Central de Operação
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={startCommercialPlan}
                    disabled={!selectedProperty || isSubmitting}
                    className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:opacity-60"
                  >
                    {isSubmitting ? "Gerando plano" : resultVersion > 0 ? "Gerar nova versão" : "Gerar plano comercial"}
                  </Button>
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
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Central de Operação</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Painel para acompanhar o preparo comercial e revisar o plano consolidado antes da operação.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoMetric
                  label="Preparação comercial"
                  value={`${Math.round((availableCompletedCount / availableFlows.length) * 100)}%`}
                  description="Percentual simulado dos fluxos disponíveis já organizados."
                />
                <InfoMetric
                  label="Materiais gerados"
                  value={plan ? `${plan.applicableFlows.length + 1}` : availableCompletedCount > 0 ? `${availableCompletedCount + 1}` : "1"}
                  description="Contagem de frentes comerciais consideradas no plano consolidado."
                />
                <InfoMetric
                  label="Fluxos concluídos"
                  value={`${availableCompletedCount}`}
                  description="Fluxos já marcados como prontos dentro deste orquestrador."
                />
                <InfoMetric
                  label="Fluxos pendentes"
                  value={`${pendingFlowsCount}`}
                  description="Itens ainda não finalizados ou aguardando implementação futura."
                />
                <InfoMetric
                  label="Última atualização"
                  value={approvedVersion ? `Versão ${approvedVersion}` : resultVersion > 0 ? `Versão ${resultVersion}` : buildLastUpdateLabel(availableCompletedCount)}
                  description="Referência da última versão gerada ou aprovada dentro do orquestrador."
                />
              </div>

              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Validação da operação comercial</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      {isReadyForOperation
                        ? "Todos os fluxos disponíveis já foram concluídos. O imóvel pode avançar para prontidão comercial."
                        : "Conclua os fluxos disponíveis e aprove o plano comercial para liberar a etapa final de prontidão."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={startCommercialPlan}
                      disabled={!selectedProperty || isSubmitting}
                      className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:opacity-60"
                    >
                      {isSubmitting ? "Gerando plano" : resultVersion > 0 ? "Gerar nova versão" : "Gerar plano"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setCurrentStep("readiness")}
                      disabled={!isReadyForOperation}
                      className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                    >
                      Validar prontidão
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {generationError ? (
                <div className="rounded-[1.15rem] border border-[#F3C7C7] bg-[#FFF7F7] px-4 py-3 text-sm text-[#B42318]">
                  {generationError}
                </div>
              ) : null}

              {isSubmitting ? (
                <EmeLoading
                  message="Gerando plano comercial com IA"
                  description="Consolidando estratégia de venda, público, campanha principal, cronograma e próximas ações para este imóvel."
                  className="min-h-[20rem] border border-[#009b3a]/18 bg-[#eef9f1]"
                />
              ) : plan ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <PlanPreviewCard
                      title="Estratégia de venda"
                      approved={approvedBlocks.strategy}
                      onApprove={() => togglePlanBlock("strategy")}
                      content={<ParagraphCard text={plan.salesStrategy} />}
                    />
                    <PlanPreviewCard
                      title="Público recomendado"
                      approved={approvedBlocks.audience}
                      onApprove={() => togglePlanBlock("audience")}
                      content={<ParagraphCard text={plan.recommendedAudience} />}
                    />
                    <PlanPreviewCard
                      title="Campanha principal"
                      approved={approvedBlocks.campaign}
                      onApprove={() => togglePlanBlock("campaign")}
                      content={<ParagraphCard text={plan.mainCampaign} />}
                    />
                    <PlanPreviewCard
                      title="Legenda"
                      approved={approvedBlocks.caption}
                      onApprove={() => togglePlanBlock("caption")}
                      content={<ParagraphCard text={plan.caption} />}
                    />
                    <PlanPreviewCard
                      title="CTA"
                      approved={approvedBlocks.cta}
                      onApprove={() => togglePlanBlock("cta")}
                      content={
                        <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                          <div className="inline-flex rounded-full bg-[#009b3a] px-4 py-2 text-sm font-semibold text-white">
                            {plan.cta}
                          </div>
                        </div>
                      }
                    />
                    <PlanPreviewCard
                      title="Texto para WhatsApp"
                      approved={approvedBlocks.whatsapp}
                      onApprove={() => togglePlanBlock("whatsapp")}
                      content={<ParagraphCard text={plan.whatsappText} />}
                    />
                    <PlanPreviewCard
                      title="Cronograma de divulgação"
                      approved={approvedBlocks.timeline}
                      onApprove={() => togglePlanBlock("timeline")}
                      content={<ListCard items={plan.timeline} prefix="Etapa" />}
                    />
                    <PlanPreviewCard
                      title="Próximas ações"
                      approved={approvedBlocks.nextActions}
                      onApprove={() => togglePlanBlock("nextActions")}
                      content={<ListCard items={plan.nextActions} prefix="Ação" />}
                    />
                  </div>

                  <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Fluxos orquestrados</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {plan.applicableFlows.map((flow) => (
                        <span key={flow} className="rounded-full bg-[#eef9f1] px-3 py-1.5 text-sm text-[#009b3a]">
                          {flow}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-[1.25rem] border p-4 ${approvedVersion === resultVersion && resultVersion > 0 ? "border-[#009b3a]/22 bg-[#eef9f1]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-[#050505]">
                          {approvedVersion === resultVersion && resultVersion > 0 ? "Plano comercial aprovado" : "Plano comercial pronto para revisão"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {approvedVersion === resultVersion && resultVersion > 0
                            ? `A versão ${approvedVersion} foi aprovada para conduzir a operação comercial deste imóvel.`
                            : "Revise o plano consolidado, aprove os blocos desejados e finalize ou gere outra versão."}
                        </p>
                        <p className="mt-2 text-sm text-[#6B7280]">{approvedBlocksCount} de 8 blocos revisados</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {approvedVersion !== resultVersion || resultVersion === 0 ? (
                          <Button
                            type="button"
                            onClick={approvePlan}
                            className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]"
                          >
                            Aprovar plano
                            <CheckCircle2 className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={generateAnotherVersion}
                          className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                        >
                          Gerar nova versão
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep === "readiness" ? (
                <div className="rounded-[1.35rem] border border-[#009b3a]/22 bg-[#eef9f1] p-5">
                  <p className="text-lg font-semibold text-[#050505]">Este imóvel está pronto para iniciar sua operação comercial.</p>
                  <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                    Todos os fluxos disponíveis do Studio IA foram organizados para este ativo nesta simulação do orquestrador.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCurrentStep("operation")}
                      className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      Abrir fluxo novamente
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
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-6 py-10 text-center">
                  <Clock3 className="mx-auto size-8 text-[#8B95A1]" />
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Prontidão comercial em preparação</p>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                    Conclua as ações disponíveis do checklist e aprove o plano comercial para liberar a mensagem final deste orquestrador.
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
              {buildStatusItems(currentStep, isReadyForOperation, approvedVersion === resultVersion && resultVersion > 0).map((item) => (
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

function CommercialActionCard({
  flow,
  completed,
  onToggleComplete,
}: {
  flow: CommercialFlow
  completed: boolean
  onToggleComplete: () => void
}) {
  const Icon = flow.icon

  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex size-10 items-center justify-center rounded-2xl border ${flow.isAvailable ? "border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-[#fbfbf8] text-[#8B95A1]"}`}>
            <Icon className="size-4.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[#050505]">{flow.title}</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${completed ? "bg-[#eef9f1] text-[#009b3a]" : flow.isAvailable ? "bg-[#f4f6f8] text-[#4B5563]" : "bg-[#f2f4f7] text-[#667085]"}`}>
                {completed ? "Concluído" : flow.isAvailable ? "Disponível" : "Em breve"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#6B7280]">{flow.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {flow.href ? (
            <Button
              asChild
              variant="ghost"
              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
            >
              <Link href={flow.href}>
                Abrir fluxo
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              disabled
              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#98A2B3] disabled:opacity-100"
            >
              Em breve
            </Button>
          )}
          {flow.isAvailable ? (
            <Button
              type="button"
              onClick={onToggleComplete}
              className={`h-10 rounded-xl px-4 text-sm font-semibold ${completed ? "border border-black/[0.06] bg-white text-[#4B5563] hover:bg-white hover:text-[#050505]" : "bg-[#009b3a] text-white hover:bg-[#008633]"}`}
            >
              {completed ? "Marcar pendente" : "Marcar concluído"}
            </Button>
          ) : null}
        </div>
      </div>
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

function InfoMetric({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#050505]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  )
}

function PlanPreviewCard({
  title,
  approved,
  onApprove,
  content,
}: {
  title: string
  approved: boolean
  onApprove: () => void
  content: React.ReactNode
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

function ParagraphCard({ text }: { text: string }) {
  return <p className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4 text-sm leading-6 text-[#5F6B7A]">{text}</p>
}

function ListCard({ items, prefix }: { items: string[]; prefix: string }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={`${prefix}-${index}-${item}`} className="rounded-[1rem] border border-black/[0.06] bg-white p-4">
          <span className="rounded-full bg-[#eef9f1] px-2.5 py-1 text-[11px] font-medium text-[#009b3a]">
            {prefix} {index + 1}
          </span>
          <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">{item}</p>
        </div>
      ))}
    </div>
  )
}

function buildLastUpdateLabel(completedCount: number) {
  if (completedCount >= 2) return "Agora mesmo"
  if (completedCount === 1) return "Há poucos minutos"
  return "Aguardando preparação"
}

function stepOrder(step: StudioStep) {
  if (step === "selection") return 0
  if (step === "checklist") return 1
  if (step === "operation") return 2
  return 3
}

function buildStatusItems(step: StudioStep, isReadyForOperation: boolean, isPlanApproved: boolean) {
  return [
    {
      title: "Etapa atual",
      value:
        step === "selection"
          ? "Seleção"
          : step === "checklist"
            ? "Checklist"
            : step === "operation"
              ? "Central de Operação"
              : "Prontidão comercial",
      description: "O Studio organiza a venda do imóvel em uma sequência única para futura automação completa.",
    },
    {
      title: "Integrações",
      value: "Plano em criação",
      description: "A estratégia é preparada a partir do imóvel e das informações da venda.",
    },
    {
      title: "Prontidão",
      value: isReadyForOperation ? "Liberada" : isPlanApproved ? "Plano aprovado" : "Em andamento",
      description: "A etapa final é habilitada apenas quando todos os fluxos disponíveis forem concluídos e o plano for aprovado.",
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
