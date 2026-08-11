"use client"
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronLeft,
  RefreshCcw,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"

type StudioStep = "selection" | "configuration" | "processing" | "result" | "approval"
type CaptureGoal =
  | "Captar imovel para venda"
  | "Captar imovel para locacao"
  | "Captar imovel de alto padrao"
  | "Captar lancamentos"
  | "Captar imoveis comerciais"
type OwnerProfile = "Proprietario particular" | "Investidor" | "Construtora" | "Incorporadora"
type StrategyBlockKey = "audience" | "approach" | "adCopy" | "instagram" | "video" | "whatsapp" | "cta" | "timeline"

type OwnerStrategyPreview = {
  audience: string
  approach: string
  adCopy: string
  instagramCaption: string
  videoScript: string[]
  whatsappText: string
  cta: string
  timeline: string[]
}

type GenerationError = string | null

const goalOptions: CaptureGoal[] = [
  "Captar imovel para venda",
  "Captar imovel para locacao",
  "Captar imovel de alto padrao",
  "Captar lancamentos",
  "Captar imoveis comerciais",
]

const ownerProfileOptions: OwnerProfile[] = ["Proprietario particular", "Investidor", "Construtora", "Incorporadora"]

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Seleção" },
  { id: "configuration", label: "Configuração" },
  { id: "processing", label: "Processamento" },
  { id: "result", label: "Resultado" },
  { id: "approval", label: "Aprovação" },
]

export function BrokerStudioIaOwnersPage() {
  const [selectedGoal, setSelectedGoal] = useState<CaptureGoal>("Captar imovel para venda")
  const [city, setCity] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [operationRadius, setOperationRadius] = useState("")
  const [selectedOwnerProfile, setSelectedOwnerProfile] = useState<OwnerProfile>("Proprietario particular")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preview, setPreview] = useState<OwnerStrategyPreview | null>(null)
  const [generationError, setGenerationError] = useState<GenerationError>(null)
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [approvedBlocks, setApprovedBlocks] = useState<Record<StrategyBlockKey, boolean>>({
    audience: false,
    approach: false,
    adCopy: false,
    instagram: false,
    video: false,
    whatsapp: false,
    cta: false,
    timeline: false,
  })

  const canAdvanceToConfiguration = Boolean(selectedGoal)
  const canProcess = Boolean(city.trim() && neighborhood.trim() && operationRadius.trim() && selectedOwnerProfile) && !isSubmitting
  const approvedBlocksCount = Object.values(approvedBlocks).filter(Boolean).length

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let ignore = false

    studioCampaignsClient
      .getLatest("OWNERS")
      .then((storedCampaign) => {
        if (!storedCampaign || ignore) return
        applyStoredCampaign(storedCampaign)
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  function buildApprovalMap(storedCampaign: StudioCampaignRecord) {
    return {
      audience: storedCampaign.assets.find((asset) => asset.assetKey === "audience")?.status === "APPROVED",
      approach: storedCampaign.assets.find((asset) => asset.assetKey === "approach")?.status === "APPROVED",
      adCopy: storedCampaign.assets.find((asset) => asset.assetKey === "ad_copy")?.status === "APPROVED",
      instagram: storedCampaign.assets.find((asset) => asset.assetKey === "instagram")?.status === "APPROVED",
      video: storedCampaign.assets.find((asset) => asset.assetKey === "video")?.status === "APPROVED",
      whatsapp: storedCampaign.assets.find((asset) => asset.assetKey === "whatsapp")?.status === "APPROVED",
      cta: storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.status === "APPROVED",
      timeline: storedCampaign.assets.find((asset) => asset.assetKey === "timeline")?.status === "APPROVED",
    }
  }

  function applyStoredCampaign(storedCampaign: StudioCampaignRecord) {
    const metadata = (storedCampaign.metadata ?? {}) as { city?: string; neighborhood?: string; operationRadius?: string }
    const nextPreview = {
      audience: (storedCampaign.assets.find((asset) => asset.assetKey === "audience")?.content as string) ?? "",
      approach: (storedCampaign.assets.find((asset) => asset.assetKey === "approach")?.content as string) ?? "",
      adCopy: (storedCampaign.assets.find((asset) => asset.assetKey === "ad_copy")?.content as string) ?? "",
      instagramCaption: (storedCampaign.assets.find((asset) => asset.assetKey === "instagram")?.content as string) ?? "",
      videoScript: (storedCampaign.assets.find((asset) => asset.assetKey === "video")?.content as string[]) ?? [],
      whatsappText: (storedCampaign.assets.find((asset) => asset.assetKey === "whatsapp")?.content as string) ?? "",
      cta: (storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.content as string) ?? "",
      timeline: (storedCampaign.assets.find((asset) => asset.assetKey === "timeline")?.content as string[]) ?? [],
    }

    if (nextPreview.audience) setPreview(nextPreview)
    setCampaign(storedCampaign)
    if (storedCampaign.goal) setSelectedGoal(storedCampaign.goal as CaptureGoal)
    if (storedCampaign.visualIdentity) setSelectedOwnerProfile(storedCampaign.visualIdentity as OwnerProfile)
    if (metadata.city) setCity(metadata.city)
    if (metadata.neighborhood) setNeighborhood(metadata.neighborhood)
    if (metadata.operationRadius) setOperationRadius(metadata.operationRadius)
    setResultVersion(storedCampaign.version)
    setApprovedVersion(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? storedCampaign.version : null)
    setApprovedBlocks(buildApprovalMap(storedCampaign))
    setCurrentStep(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? "approval" : "result")
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
    setGenerationError(null)
    setIsSubmitting(true)
    setCurrentStep("processing")

    try {
      const response = await fetch("/api/studio-ia/owners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          goal: selectedGoal,
          city: city.trim(),
          neighborhood: neighborhood.trim(),
          operationRadius: operationRadius.trim(),
          ownerProfile: selectedOwnerProfile,
          version: nextVersion,
        }),
      })

      const data = (await response.json().catch(() => null)) as (OwnerStrategyPreview & { error?: string; campaign?: StudioCampaignRecord }) | null

      if (!response.ok || !data) {
        throw new Error(data?.error || "Não foi possível gerar a estratégia para captar proprietários.")
      }

      setPreview({
        audience: data.audience,
        approach: data.approach,
        adCopy: data.adCopy,
        instagramCaption: data.instagramCaption,
        videoScript: data.videoScript,
        whatsappText: data.whatsappText,
        cta: data.cta,
        timeline: data.timeline,
      })
      if (data.campaign) setCampaign(data.campaign)
      setApprovedBlocks({
        audience: false,
        approach: false,
        adCopy: false,
        instagram: false,
        video: false,
        whatsapp: false,
        cta: false,
        timeline: false,
      })
      setApprovedVersion(null)
      setResultVersion(nextVersion)
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
    const assetKey = block === "adCopy" ? "ad_copy" : block
    const asset = campaign.assets.find((entry) => entry.assetKey === assetKey)
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
    setCampaign(null)
    setCurrentStep("selection")
    setResultVersion(0)
    setApprovedVersion(null)
    setPreview(null)
    setGenerationError(null)
    setApprovedBlocks({
      audience: false,
      approach: false,
      adCopy: false,
      instagram: false,
      video: false,
      whatsapp: false,
      cta: false,
      timeline: false,
    })
  }

  const visualSummary = useMemo(
    () => [
      { label: "Objetivo", value: selectedGoal },
      { label: "Região", value: city && neighborhood ? `${neighborhood}, ${city}` : "Não definida" },
      { label: "Versão", value: resultVersion > 0 ? `${resultVersion}` : "Ainda não gerada" },
    ],
    [city, neighborhood, resultVersion, selectedGoal],
  )

  return (
    <BrokerPageShell title="Studio IA">
      <div className="min-w-0 grid gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Camera className="size-3.5" />
                Fluxo Studio IA
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Captar imóveis</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Crie campanhas para encontrar proprietários e ampliar sua carteira.
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
                  Voltar ao Studio IA
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
                O Studio reaproveita a mesma arquitetura em etapas e agora gera o conteúdo real no servidor para este fluxo.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Camera className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Captar imóveis</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      Estruture a abordagem comercial para aumentar captação de imóveis de acordo com objetivo, região e perfil do proprietário.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">1. Selecionar objetivo</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {goalOptions.map((goal) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => setSelectedGoal(goal)}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${selectedGoal === goal ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    onClick={goToConfiguration}
                    disabled={!canAdvanceToConfiguration}
                    className="mt-4 h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                  >
                    Avançar para configuração
                    <ArrowRight className="size-4" />
                  </Button>
                </div>

                <div className={`rounded-[1.25rem] border p-4 ${currentStep === "selection" ? "border-black/[0.06] bg-[#f6f7f4] opacity-65" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">2. Configuração</p>

                  <div className="mt-3 grid gap-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="grid gap-2 text-sm text-[#050505]">
                        <span className="font-medium">Cidade</span>
                        <input
                          value={city}
                          onChange={(event) => setCity(event.target.value)}
                          placeholder="Ex.: Santos"
                          className="h-11 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#050505] outline-none focus:ring-2 focus:ring-[#009b3a]/25"
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-[#050505]">
                        <span className="font-medium">Bairro</span>
                        <input
                          value={neighborhood}
                          onChange={(event) => setNeighborhood(event.target.value)}
                          placeholder="Ex.: Gonzaga"
                          className="h-11 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#050505] outline-none focus:ring-2 focus:ring-[#009b3a]/25"
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-[#050505]">
                        <span className="font-medium">Raio de atuação</span>
                        <input
                          value={operationRadius}
                          onChange={(event) => setOperationRadius(event.target.value)}
                          placeholder="Ex.: 5 km"
                          className="h-11 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#050505] outline-none focus:ring-2 focus:ring-[#009b3a]/25"
                        />
                      </label>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-[#050505]">Perfil do proprietário</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ownerProfileOptions.map((profile) => (
                          <button
                            key={profile}
                            type="button"
                            onClick={() => setSelectedOwnerProfile(profile)}
                            className={`rounded-full border px-4 py-2 text-sm transition-colors ${selectedOwnerProfile === profile ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                          >
                            {profile}
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
                    {generationError ? (
                      <p className="text-sm text-[#D14343]">{generationError}</p>
                    ) : null}
                  </div>
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
                <p className="mt-2 text-sm font-semibold text-[#050505]">{approvedBlocksCount} de 8 blocos revisados</p>
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
                  description={`Montando a abordagem para ${selectedOwnerProfile.toLowerCase()} com foco em ${selectedGoal.toLowerCase()}.`}
                  className="min-h-[22rem] border border-[#009b3a]/18 bg-[#eef9f1]"
                />
              ) : currentStep === "result" || currentStep === "approval" ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <PreviewCard
                      title="Público recomendado"
                      approved={approvedBlocks.audience}
                      onApprove={() => toggleBlockApproval("audience")}
                      content={<TextBlock icon={<Camera className="size-4.5" />} title={preview?.audience ?? "--"} description="Perfil de proprietário com maior aderência para a captação definida." />}
                    />

                    <PreviewCard
                      title="Abordagem sugerida"
                      approved={approvedBlocks.approach}
                      onApprove={() => toggleBlockApproval("approach")}
                      content={<ParagraphCard text={preview?.approach ?? "--"} />}
                    />

                    <PreviewCard
                      title="Texto para anúncio"
                      approved={approvedBlocks.adCopy}
                      onApprove={() => toggleBlockApproval("adCopy")}
                      content={<ParagraphCard text={preview?.adCopy ?? "--"} />}
                    />

                    <PreviewCard
                      title="Legenda para Instagram"
                      approved={approvedBlocks.instagram}
                      onApprove={() => toggleBlockApproval("instagram")}
                      content={<ParagraphCard text={preview?.instagramCaption ?? "--"} />}
                    />

                    <PreviewCard
                      title="Roteiro para vídeo"
                      approved={approvedBlocks.video}
                      onApprove={() => toggleBlockApproval("video")}
                      content={
                        <div className="grid gap-3">
                          {preview?.videoScript.map((item, index) => (
                            <StepCard key={`${item}-${index}`} index={index + 1} text={item} />
                          ))}
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Texto para WhatsApp"
                      approved={approvedBlocks.whatsapp}
                      onApprove={() => toggleBlockApproval("whatsapp")}
                      content={<ParagraphCard text={preview?.whatsappText ?? "--"} />}
                    />

                    <PreviewCard
                      title="CTA"
                      approved={approvedBlocks.cta}
                      onApprove={() => toggleBlockApproval("cta")}
                      content={
                        <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                          <div className="inline-flex rounded-full bg-[#009b3a] px-4 py-2 text-sm font-semibold text-white">
                            {preview?.cta ?? "--"}
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
                            <StepCard key={`${item}-${index}`} index={index + 1} text={item} />
                          ))}
                        </div>
                      }
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
                            ? `A estratégia versão ${approvedVersion ?? resultVersion} foi aprovada para ${selectedOwnerProfile.toLowerCase()} em ${city}.`
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
                  <Camera className="size-8 text-[#8B95A1]" />
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

function TextBlock({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#050505]">{title}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{description}</p>
        </div>
      </div>
    </div>
  )
}

function ParagraphCard({ text }: { text: string }) {
  return <p className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4 text-sm leading-6 text-[#5F6B7A]">{text}</p>
}

function StepCard({ index, text }: { index: number; text: string }) {
  return (
    <div className="rounded-[1rem] border border-black/[0.06] bg-white p-4">
      <span className="rounded-full bg-[#eef9f1] px-2.5 py-1 text-[11px] font-medium text-[#009b3a]">
        Etapa {index}
      </span>
      <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">{text}</p>
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
