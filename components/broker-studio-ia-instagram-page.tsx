"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  Instagram,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StudioStep = "selection" | "configuration" | "processing" | "result" | "approval"
type CampaignGoal = "Venda" | "Captacao" | "Lancamento" | "Alto padrao" | "Investimento" | "Aluguel"
type VisualIdentity = "Moderna" | "Luxo" | "Minimalista" | "Comercial"
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

const goalOptions: CampaignGoal[] = ["Venda", "Captacao", "Lancamento", "Alto padrao", "Investimento", "Aluguel"]
const identityOptions: VisualIdentity[] = ["Moderna", "Luxo", "Minimalista", "Comercial"]

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Selecao" },
  { id: "configuration", label: "Configuracao" },
  { id: "processing", label: "Processamento" },
  { id: "result", label: "Resultado" },
  { id: "approval", label: "Aprovacao" },
]

const previewItemLabels: Array<{ key: CampaignItemKey; label: string }> = [
  { key: "postFeed", label: "Post Feed" },
  { key: "story", label: "Story" },
  { key: "carousel", label: "Carrossel" },
  { key: "caption", label: "Legenda" },
  { key: "cta", label: "CTA" },
  { key: "hashtags", label: "Hashtags" },
]

export function BrokerStudioIaInstagramPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedGoal, setSelectedGoal] = useState<CampaignGoal>("Venda")
  const [selectedIdentity, setSelectedIdentity] = useState<VisualIdentity>("Moderna")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
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

  useEffect(() => {
    if (!selectedPropertyId && propertyOptions[0]) {
      setSelectedPropertyId(propertyOptions[0].id)
    }
  }, [propertyOptions, selectedPropertyId])

  useEffect(() => {
    if (currentStep !== "processing") return

    const timeoutId = window.setTimeout(() => {
      const nextVersion = resultVersion + 1
      setPreview(buildCampaignPreview({
        propertyTitle: selectedProperty?.title ?? "Imovel em destaque",
        city: selectedProperty?.city ?? "sua cidade",
        neighborhood: selectedProperty?.neighborhood ?? "bairro estrategico",
        goal: selectedGoal,
        identity: selectedIdentity,
        version: nextVersion,
      }))
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
      setIsSubmitting(false)
      setCurrentStep("result")
    }, 1600)

    return () => window.clearTimeout(timeoutId)
  }, [currentStep, resultVersion, selectedGoal, selectedIdentity, selectedProperty])

  const canAdvanceToConfiguration = Boolean(selectedProperty)
  const canProcess = Boolean(selectedProperty) && !isSubmitting
  const approvedItemsCount = Object.values(approvedItems).filter(Boolean).length

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    resetResultState()
    setCurrentStep("selection")
  }

  function goToConfiguration() {
    if (!canAdvanceToConfiguration) return
    setCurrentStep("configuration")
  }

  function startProcessing() {
    if (!canProcess) return
    setIsSubmitting(true)
    setCurrentStep("processing")
  }

  function toggleItemApproval(item: CampaignItemKey) {
    setApprovedItems((current) => ({
      ...current,
      [item]: !current[item],
    }))
  }

  function approveCampaign() {
    if (!resultVersion) return
    setApprovedVersion(resultVersion)
    setCurrentStep("approval")
  }

  function generateAnotherVersion() {
    if (!canProcess) return
    setApprovedVersion(null)
    setCurrentStep("processing")
    setIsSubmitting(true)
  }

  function restartFlow() {
    resetResultState()
    setCurrentStep("selection")
  }

  function resetResultState() {
    setResultVersion(0)
    setApprovedVersion(null)
    setPreview(null)
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
      { label: "Versao", value: resultVersion > 0 ? `${resultVersion}` : "Ainda nao gerada" },
    ],
    [resultVersion, selectedGoal, selectedIdentity],
  )

  const coverImage = selectedProperty?.images[0] ?? ""

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Instagram className="size-3.5" />
                Segundo fluxo Studio IA
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Criar campanha para Instagram</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Selecione o imovel, defina o objetivo da campanha, escolha a identidade visual e acompanhe a geracao simulada ate a aprovacao final.
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

        <section className="grid gap-2 md:grid-cols-5">
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Fluxo visual</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                O Studio usa a mesma experiencia em etapas para facilitar futuras integracoes com IA real.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Instagram className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Criar campanha para Instagram</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      Monte uma campanha simulada com pecas prontas para feed, story, carrossel, legenda, CTA e hashtags.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">1. Selecionar imovel</p>
                    <span className="text-xs text-[#7B8491]">{propertyOptions.length} disponivel(is)</span>
                  </div>

                  {isLoading ? (
                    <p className="mt-3 text-sm text-[#6B7280]">Carregando imoveis do corretor...</p>
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
                        Avancar para configuracao
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <EmptyPropertiesState />
                  )}
                </div>

                <div className={`rounded-[1.25rem] border p-4 ${currentStep === "selection" ? "border-black/[0.06] bg-[#f6f7f4] opacity-65" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">2. Configuracao</p>

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

                      <Button
                        type="button"
                        onClick={startProcessing}
                        disabled={!canProcess}
                        className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                      >
                        {isSubmitting ? "Gerando campanha" : "Gerar campanha"}
                        <Wand2 className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#6B7280]">Escolha um imovel primeiro para liberar a configuracao.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Aprovacoes da campanha</p>
                <p className="mt-2 text-sm font-semibold text-[#050505]">{approvedItemsCount} de 6 pecas revisadas</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  Cada item da campanha possui sua propria aprovacao para manter a mesma logica de revisao do Studio IA.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Resultado e aprovacao</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Revise a campanha simulada, aprove cada peca e finalize a campanha quando estiver pronta.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              {currentStep === "processing" ? (
                <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-[1.35rem] border border-[#009b3a]/18 bg-[#eef9f1] px-6 text-center">
                  <LoaderCircle className="size-8 animate-spin text-[#009b3a]" />
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Gerando campanha simulada</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#5F6B7A]">
                    Montando a campanha para Instagram com foco em {selectedGoal.toLowerCase()} e identidade {selectedIdentity.toLowerCase()}.
                  </p>
                </div>
              ) : currentStep === "result" || currentStep === "approval" ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <PreviewCard
                      title="Post Feed"
                      approved={approvedItems.postFeed}
                      onApprove={() => toggleItemApproval("postFeed")}
                      content={
                        <div className="overflow-hidden rounded-[1.2rem] border border-black/[0.06] bg-white">
                          <div className="relative aspect-square bg-[#dfe8df]">
                            {coverImage ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={coverImage} alt="Preview do post feed" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                              </>
                            ) : null}
                            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/80">{selectedGoal}</p>
                              <p className="mt-2 text-xl font-semibold">{preview?.postFeed.title}</p>
                              <p className="mt-1 text-sm text-white/85">{preview?.postFeed.highlight}</p>
                            </div>
                          </div>
                          <div className="px-4 py-3 text-sm text-[#5F6B7A]">{preview?.postFeed.support}</div>
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Story"
                      approved={approvedItems.story}
                      onApprove={() => toggleItemApproval("story")}
                      content={
                        <div className="mx-auto aspect-[9/16] w-full max-w-[14rem] overflow-hidden rounded-[1.6rem] border border-black/[0.06] bg-[linear-gradient(180deg,#0f172a_0%,#1f3d2f_100%)] p-4 text-white">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{preview?.story.kicker}</p>
                          <p className="mt-8 text-2xl font-semibold leading-tight">{preview?.story.line1}</p>
                          <p className="mt-3 text-base text-white/80">{preview?.story.line2}</p>
                          <div className="mt-auto rounded-full bg-white/12 px-3 py-2 text-sm">{selectedIdentity}</div>
                        </div>
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
                          {currentStep === "approval" ? "Campanha aprovada com sucesso" : "Campanha pronta para revisao"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {currentStep === "approval"
                            ? `A campanha versao ${approvedVersion ?? resultVersion} foi aprovada para o objetivo ${selectedGoal.toLowerCase()}.`
                            : "Revise cada peca da campanha, aprove os itens desejados e finalize ou gere outra versao."}
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
                              Gerar nova versao
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
                              Gerar nova versao
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
                    Avance pelas etapas de selecao e configuracao para iniciar a geracao simulada desta campanha.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
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

function buildCampaignPreview({
  propertyTitle,
  city,
  neighborhood,
  goal,
  identity,
  version,
}: {
  propertyTitle: string
  city: string
  neighborhood: string
  goal: CampaignGoal
  identity: VisualIdentity
  version: number
}): CampaignPreview {
  return {
    postFeed: {
      title: propertyTitle,
      highlight: `${goal} com linguagem ${identity.toLowerCase()} e foco em conversao.`,
      support: `${neighborhood} em ${city} com apresentacao pronta para o feed da imobiliaria.`,
    },
    story: {
      kicker: `Versao ${version}`,
      line1: `Campanha para ${goal.toLowerCase()}`,
      line2: `Destaque rapido do imovel com identidade ${identity.toLowerCase()}.`,
    },
    carousel: [
      `Apresente o imovel e conecte o publico ao contexto de ${goal.toLowerCase()}.`,
      `Mostre diferenciais, localizacao e valor percebido com linguagem ${identity.toLowerCase()}.`,
      "Feche o carrossel com chamada comercial clara para gerar conversa e conversao.",
    ],
    caption: `${propertyTitle} ganha uma campanha focada em ${goal.toLowerCase()}, com tom ${identity.toLowerCase()} e argumentos prontos para despertar interesse logo nos primeiros segundos. Destaque localizacao, diferencial e oportunidade para incentivar o contato direto do publico ideal.`,
    cta: goal === "Captacao" ? "Fale com nosso time e anuncie seu imovel" : "Chame no direct e receba os detalhes",
    hashtags: [
      "#mercadoimobiliario",
      `#${normalizeTag(goal)}`,
      `#${normalizeTag(identity)}`,
      `#${normalizeTag(city)}`,
      "#corretordeimoveis",
      "#eme",
    ],
  }
}

function normalizeTag(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
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
          ? "Selecao"
          : step === "configuration"
            ? "Configuracao"
            : step === "processing"
              ? "Geracao simulada"
              : step === "result"
                ? "Resultado"
                : "Aprovacao",
      description: "O Studio reaproveita a mesma sequencia de etapas para facilitar a evolucao futura com IA real.",
    },
    {
      title: "Integracoes",
      value: "Simuladas",
      description: "Este fluxo ainda nao aciona OpenAI nem outras APIs. Toda a campanha e montada localmente na interface.",
    },
    {
      title: "Persistencia",
      value: "Sem alterar banco",
      description: "As aprovacoes e versoes da campanha existem apenas na sessao atual, preservando a arquitetura do portal.",
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
          <p className="font-semibold text-[#050505]">Nenhum imovel disponivel</p>
          <p className="mt-1 text-sm leading-6 text-[#6B7280]">
            Cadastre ou publique um imovel para iniciar este fluxo do Studio IA.
          </p>
          <Button asChild className="mt-3 h-9 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]">
            <Link href="/corretor/novo-imovel">Cadastrar imovel</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
