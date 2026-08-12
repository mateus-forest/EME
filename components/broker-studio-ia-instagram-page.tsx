"use client"
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  Instagram,
  RefreshCcw,
  Wand2,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"
import { getAssetPreviewSource } from "@/lib/studio-campaigns-ui"
import {
  getStudioCapabilityProviders,
  STUDIO_PROVIDER_LABELS,
} from "@/lib/studio-provider-catalog"
import type { StudioProviderId } from "@/lib/studio-providers/types"

type StudioStep = "selection" | "configuration" | "processing" | "result" | "approval"
type CampaignGoal = "Venda" | "Captacao" | "Lancamento" | "Alto padrao" | "Investimento" | "Aluguel"
type VisualIdentity = "Moderna" | "Luxo" | "Minimalista" | "Comercial"
type CampaignProvider = Extract<StudioProviderId, "openai" | "xai">
type CampaignItemKey = "postFeed" | "story" | "carousel" | "caption" | "cta" | "hashtags"

type CampaignPreview = {
  postFeed: {
    title: string
    highlight: string
    support: string
  }
  story: {
    kicker: string
    line1: string
    line2: string
  }
  carousel: string[]
  caption: string
  cta: string
  hashtags: string[]
}

type GenerationError = string | null
type CreditBlockState = {
  availableCredits: number
  requiredCredits: number
  ctaHref: string
  ctaLabel: string
} | null

const goalOptions: CampaignGoal[] = ["Venda", "Captacao", "Lancamento", "Alto padrao", "Investimento", "Aluguel"]
const identityOptions: VisualIdentity[] = ["Moderna", "Luxo", "Minimalista", "Comercial"]
const campaignProviderOptions = getStudioCapabilityProviders("campaign.structured_content", ["active"])

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Seleção" },
  { id: "configuration", label: "Configuração" },
  { id: "processing", label: "Processamento" },
  { id: "result", label: "Resultado" },
  { id: "approval", label: "Aprovação" },
]

const previewItemLabels: Array<{ key: CampaignItemKey; label: string }> = [
  { key: "postFeed", label: "Post Feed" },
  { key: "story", label: "Story" },
  { key: "carousel", label: "Carrossel" },
  { key: "caption", label: "Legenda" },
  { key: "cta", label: "CTA" },
  { key: "hashtags", label: "Hashtags" },
]

const instagramAssetKeyMap: Record<CampaignItemKey, string> = {
  postFeed: "post_feed",
  story: "story",
  carousel: "carousel",
  caption: "caption",
  cta: "cta",
  hashtags: "hashtags",
}

export function BrokerStudioIaInstagramPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedGoal, setSelectedGoal] = useState<CampaignGoal>("Venda")
  const [selectedIdentity, setSelectedIdentity] = useState<VisualIdentity>("Moderna")
  const [selectedProvider, setSelectedProvider] = useState<CampaignProvider>("openai")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [generationError, setGenerationError] = useState<GenerationError>(null)
  const [creditBlock, setCreditBlock] = useState<CreditBlockState>(null)
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [approvedItems, setApprovedItems] = useState<Record<CampaignItemKey, boolean>>({
    postFeed: false,
    story: false,
    carousel: false,
    caption: false,
    cta: false,
    hashtags: false,
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
      .getLatest("INSTAGRAM", selectedPropertyId)
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
  const approvedItemsCount = Object.values(approvedItems).filter(Boolean).length

  function buildApprovalMap(storedCampaign: StudioCampaignRecord) {
    return {
      postFeed: storedCampaign.assets.find((asset) => asset.assetKey === "post_feed")?.status === "APPROVED",
      story: storedCampaign.assets.find((asset) => asset.assetKey === "story")?.status === "APPROVED",
      carousel: storedCampaign.assets.find((asset) => asset.assetKey === "carousel")?.status === "APPROVED",
      caption: storedCampaign.assets.find((asset) => asset.assetKey === "caption")?.status === "APPROVED",
      cta: storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.status === "APPROVED",
      hashtags: storedCampaign.assets.find((asset) => asset.assetKey === "hashtags")?.status === "APPROVED",
    }
  }

  function applyStoredCampaign(storedCampaign: StudioCampaignRecord) {
    const postFeed = storedCampaign.assets.find((asset) => asset.assetKey === "post_feed")?.content as CampaignPreview["postFeed"] | undefined
    const story = storedCampaign.assets.find((asset) => asset.assetKey === "story")?.content as CampaignPreview["story"] | undefined
    const carousel = storedCampaign.assets.find((asset) => asset.assetKey === "carousel")?.content as string[] | undefined
    const caption = storedCampaign.assets.find((asset) => asset.assetKey === "caption")?.content as string | undefined
    const cta = storedCampaign.assets.find((asset) => asset.assetKey === "cta")?.content as string | undefined
    const hashtags = storedCampaign.assets.find((asset) => asset.assetKey === "hashtags")?.content as string[] | undefined

    if (postFeed && story && carousel && caption && cta && hashtags) {
      setPreview({ postFeed, story, carousel, caption, cta, hashtags })
    }

    setCampaign(storedCampaign)
    if (storedCampaign.goal) {
      setSelectedGoal(storedCampaign.goal as CampaignGoal)
    }
    if (storedCampaign.visualIdentity) {
      setSelectedIdentity(storedCampaign.visualIdentity as VisualIdentity)
    }
    if (storedCampaign.provider === "openai" || storedCampaign.provider === "xai") {
      setSelectedProvider(storedCampaign.provider)
    }
    setResultVersion(storedCampaign.version)
    setApprovedVersion(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? storedCampaign.version : null)
    setApprovedItems(buildApprovalMap(storedCampaign))
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
    await requestCampaignGeneration(nextVersion)
  }

  async function requestCampaignGeneration(nextVersion: number) {
    if (!selectedProperty) return

    setGenerationError(null)
    setCreditBlock(null)
    setIsSubmitting(true)
    setCurrentStep("processing")

    try {
      const response = await fetch("/api/studio-ia/instagram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          goal: selectedGoal,
          identity: selectedIdentity,
          provider: selectedProvider,
          version: nextVersion,
        }),
      })

      const data = (await response.json().catch(() => null)) as (CampaignPreview & {
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
        throw new Error(data?.error || "Não foi possível gerar a campanha para Instagram.")
      }

      setPreview({
        postFeed: data.postFeed,
        story: data.story,
        carousel: data.carousel,
        caption: data.caption,
        cta: data.cta,
        hashtags: data.hashtags,
      })
      if (data.campaign) {
        setCampaign(data.campaign)
      }
      setResultVersion(nextVersion)
      setApprovedVersion(null)
      setApprovedItems({
        postFeed: false,
        story: false,
        carousel: false,
        caption: false,
        cta: false,
        hashtags: false,
      })
      setCurrentStep("result")
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível gerar a campanha.")
      setCurrentStep("configuration")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleItemApproval(item: CampaignItemKey) {
    if (!campaign) return
    const assetKey = instagramAssetKeyMap[item]
    const asset = campaign.assets.find((entry) => entry.assetKey === assetKey)
    if (!asset) return

    try {
      const nextCampaign = await studioCampaignsClient.updateAssetStatus(
        asset.id,
        approvedItems[item] ? "PENDING_REVIEW" : "APPROVED",
      )
      applyStoredCampaign(nextCampaign)
    } catch {
      return
    }
  }

  async function approveCampaign() {
    if (!campaign || !resultVersion) return
    try {
      const approvedCampaign = await studioCampaignsClient.approveCampaign(campaign.id)
      applyStoredCampaign(approvedCampaign)
    } catch {
      return
    }
  }

  async function generateAnotherVersion() {
    if (!canProcess) return
    setApprovedVersion(null)
    await requestCampaignGeneration(resultVersion + 1)
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
    setApprovedItems({
      postFeed: false,
      story: false,
      carousel: false,
      caption: false,
      cta: false,
      hashtags: false,
    })
    setIsSubmitting(false)
  }

  const visualSummary = useMemo(
    () => [
      { label: "Objetivo", value: selectedGoal },
      { label: "Identidade", value: selectedIdentity },
      { label: "Conteúdo", value: STUDIO_PROVIDER_LABELS[selectedProvider] },
      { label: "Versão", value: resultVersion > 0 ? `${resultVersion}` : "Ainda não gerada" },
    ],
    [resultVersion, selectedGoal, selectedIdentity, selectedProvider],
  )

  const coverImage = selectedProperty?.images[0] ?? ""
  const postFeedAsset = useMemo(
    () => campaign?.assets.find((asset) => asset.assetKey === "post_feed") ?? null,
    [campaign],
  )
  const storyAsset = useMemo(
    () => campaign?.assets.find((asset) => asset.assetKey === "story") ?? null,
    [campaign],
  )
  const postFeedPreviewSrc = postFeedAsset && campaign ? getAssetPreviewSource(campaign, postFeedAsset) : null
  const storyPreviewSrc = storyAsset && campaign ? getAssetPreviewSource(campaign, storyAsset) : null

  return (
    <BrokerPageShell title="Studio IA">
      <div className="min-w-0 grid gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Instagram className="size-3.5" />
                Conteúdo para redes sociais
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Criar campanha</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Crie conteúdo completo para divulgar seus imóveis nas redes sociais.
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
                O Studio usa a mesma experiência em etapas e agora gera o conteúdo real no servidor para este fluxo.
              </p>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Instagram className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Criar campanha</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      Monte uma campanha com pecas reais prontas para feed, story, carrossel, legenda, CTA e hashtags.
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
                        <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#050505]">{selectedProperty.title}</p>
                              <p className="mt-1 text-sm text-[#6B7280]">
                                {selectedProperty.neighborhood}, {selectedProperty.city}
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${selectedProperty.status === "Publicado" ? "bg-[#eef9f1] text-[#009b3a]" : "bg-[#f2f4f7] text-[#667085]"}`}>
                              {selectedProperty.status}
                            </span>
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
                        <p className="text-sm font-medium text-[#050505]">Escolha o objetivo da campanha</p>
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
                      </div>

                      <div>
                        <p className="text-sm font-medium text-[#050505]">Escolha a identidade visual</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {identityOptions.map((identity) => (
                            <button
                              key={identity}
                              type="button"
                              onClick={() => setSelectedIdentity(identity)}
                              className={`rounded-full border px-4 py-2 text-sm transition-colors ${selectedIdentity === identity ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                            >
                              {identity}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-[#050505]">Motor de conteúdo</p>
                        <p className="mt-1 text-xs text-[#8B95A1]">
                          O layout das peças permanece o mesmo; muda apenas a geração dos textos.
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="campaign-provider-options">
                          {campaignProviderOptions.map((entry) => {
                            const provider = entry.provider as CampaignProvider
                            return (
                              <button
                                key={provider}
                                type="button"
                                onClick={() => setSelectedProvider(provider)}
                                aria-pressed={selectedProvider === provider}
                                data-testid={`campaign-provider-${provider}`}
                                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${selectedProvider === provider ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                              >
                                <span className="block font-semibold">{STUDIO_PROVIDER_LABELS[provider]}{provider === "openai" ? " · Recomendado" : ""}</span>
                                <span className="mt-1 block text-xs font-normal leading-5 text-[#7B8491]">{provider === "openai" ? "Consistente para campanhas imobiliárias." : "Alternativa criativa para conteúdo e linguagem."}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={startProcessing}
                        disabled={!canProcess}
                        className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                      >
                        {isSubmitting ? "Gerando campanha" : "Gerar campanha"}
                        <Wand2 className="size-4" />
                      </Button>
                      <p className="text-sm text-[#6B7280]">Consome 10 Créditos IA por execução.</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Aprovações da campanha</p>
                <p className="mt-2 text-sm font-semibold text-[#050505]">{approvedItemsCount} de 6 peças revisadas</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  Cada item da campanha possui sua própria aprovação para manter a mesma lógica de revisão do Studio IA.
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
                Revise a campanha gerada, aprove cada peça e finalize a campanha quando estiver pronta.
              </p>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
              {currentStep === "processing" ? (
                <EmeLoading
                  message="Gerando campanha com IA"
                  description={`Montando a campanha para Instagram com foco em ${selectedGoal.toLowerCase()} e identidade ${selectedIdentity.toLowerCase()}.`}
                  className="min-h-[22rem] border border-[#009b3a]/18 bg-[#eef9f1]"
                />
              ) : currentStep === "result" || currentStep === "approval" ? (
                <div className="grid gap-4">
                  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                    <PreviewCard
                      title="Post Feed"
                      approved={approvedItems.postFeed}
                      onApprove={() => toggleItemApproval("postFeed")}
                      content={
                        postFeedPreviewSrc ? (
                          <div className="overflow-hidden rounded-[1.2rem] border border-black/[0.06] bg-white">
                            <img src={postFeedPreviewSrc} alt="Preview do post feed" className="aspect-square w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex aspect-square items-center justify-center rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-6 text-center text-sm text-[#6B7280]">
                            O preview oficial do template sera exibido assim que a campanha estiver disponivel.
                          </div>
                        )
                      }
                    />

                    <PreviewCard
                      title="Story"
                      approved={approvedItems.story}
                      onApprove={() => toggleItemApproval("story")}
                      content={
                        storyPreviewSrc ? (
                          <div className="mx-auto w-full max-w-[20rem] overflow-hidden rounded-[1.6rem] border border-black/[0.06] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                            <img src={storyPreviewSrc} alt="Preview do story" className="aspect-[9/16] w-full object-contain bg-[#f8faf8]" />
                          </div>
                        ) : (
                          <div className="mx-auto flex aspect-[9/16] w-full max-w-[20rem] items-center justify-center rounded-[1.6rem] border border-black/[0.06] bg-[#fbfbf8] p-6 text-center text-sm text-[#6B7280]">
                            O preview oficial do template sera exibido assim que a campanha estiver disponivel.
                          </div>
                        )
                      }
                    />

                    <PreviewCard
                      title="Carrossel"
                      approved={approvedItems.carousel}
                      onApprove={() => toggleItemApproval("carousel")}
                      content={
                        <div className="grid gap-3 sm:grid-cols-3">
                          {preview?.carousel.map((slide, index) => (
                            <div key={`${slide}-${index}`} className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                              <span className="rounded-full bg-[#eef9f1] px-2.5 py-1 text-[11px] font-medium text-[#009b3a]">
                                Slide {index + 1}
                              </span>
                              <p className="mt-4 text-sm font-semibold leading-6 text-[#050505]">{slide}</p>
                            </div>
                          ))}
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Legenda"
                      approved={approvedItems.caption}
                      onApprove={() => toggleItemApproval("caption")}
                      content={<p className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4 text-sm leading-6 text-[#5F6B7A]">{preview?.caption}</p>}
                    />

                    <PreviewCard
                      title="CTA"
                      approved={approvedItems.cta}
                      onApprove={() => toggleItemApproval("cta")}
                      content={
                        <div className="rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                          <div className="inline-flex rounded-full bg-[#009b3a] px-4 py-2 text-sm font-semibold text-white">
                            {preview?.cta}
                          </div>
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Hashtags"
                      approved={approvedItems.hashtags}
                      onApprove={() => toggleItemApproval("hashtags")}
                      content={
                        <div className="flex flex-wrap gap-2 rounded-[1.15rem] border border-black/[0.06] bg-white p-4">
                          {preview?.hashtags.map((tag) => (
                            <span key={tag} className="rounded-full bg-[#f4f6f8] px-3 py-1.5 text-sm text-[#4B5563]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      }
                    />
                  </div>

                  <div className={`rounded-[1.25rem] border p-4 ${currentStep === "approval" ? "border-[#009b3a]/22 bg-[#eef9f1]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-[#050505]">
                          {currentStep === "approval" ? "Campanha aprovada com sucesso" : "Campanha pronta para revisão"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {currentStep === "approval"
                            ? `A campanha versão ${approvedVersion ?? resultVersion} foi aprovada para o objetivo ${selectedGoal.toLowerCase()}.`
                            : "Revise cada peça da campanha, aprove os itens desejados e finalize ou gere outra versão."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentStep !== "approval" ? (
                          <>
                            <Button
                              type="button"
                              onClick={approveCampaign}
                              className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]"
                            >
                              Aprovar campanha
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
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Nenhuma campanha gerada ainda</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7280]">
                    Avance pelas etapas de seleção e configuração para iniciar a geração desta campanha.
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
              ? "Geração"
              : step === "result"
                ? "Resultado"
                : "Aprovação",
      description: "O Studio reaproveita a mesma sequência de etapas para manter consistência e permitir novas versões do conteúdo.",
    },
    {
      title: "Integrações",
      value: "Conteúdo em criação",
      description: "O Studio prepara o conteúdo e mantém o formato visual já aprovado para a campanha.",
    },
    {
      title: "Persistência",
      value: "Salvo na Biblioteca",
      description: "Versões e aprovações ficam disponíveis para consulta e continuidade no Studio.",
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
