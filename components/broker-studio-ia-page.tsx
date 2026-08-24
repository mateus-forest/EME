"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Home,
  ImagePlus,
  ChevronLeft,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react"
import { z } from "zod"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"
import { formatCountLabel } from "@/lib/structured-fields"

type StudioStep = "selection" | "configuration" | "processing" | "result" | "approval"
type StudioStyle = "Moderno" | "Minimalista" | "Alto padrao" | "Industrial" | "Classico"

const styleOptions: StudioStyle[] = [
  "Moderno",
  "Minimalista",
  "Alto padrao",
  "Industrial",
  "Classico",
]

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Seleção" },
  { id: "configuration", label: "Configuração" },
  { id: "processing", label: "Processamento" },
  { id: "result", label: "Resultado" },
  { id: "approval", label: "Aprovação" },
]

const studioGenerationResponseSchema = z.object({
  imageUrl: z.string().trim().url(),
})

export function BrokerStudioIaPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedImage, setSelectedImage] = useState("")
  const [selectedStyle, setSelectedStyle] = useState<StudioStyle>("Moderno")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null)
  const [generatedImageUrl, setGeneratedImageUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generationError, setGenerationError] = useState("")
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)

  const propertyOptions = useMemo(
    () => (properties.filter((property) => property.images.length > 0).length > 0
      ? properties.filter((property) => property.images.length > 0)
      : properties),
    [properties],
  )

  const selectedProperty = useMemo(
    () => propertyOptions.find((property) => property.id === selectedPropertyId) ?? null,
    [propertyOptions, selectedPropertyId],
  )

  const availableImages = useMemo(
    () => selectedProperty?.images ?? [],
    [selectedProperty],
  )

  useEffect(() => {
    if (!selectedPropertyId && propertyOptions[0]) {
      setSelectedPropertyId(propertyOptions[0].id)
    }
  }, [propertyOptions, selectedPropertyId])

  useEffect(() => {
    if (!selectedPropertyId) return
    let ignore = false

    studioCampaignsClient
      .getLatest("CONSTRUCTION", selectedPropertyId)
      .then((storedCampaign) => {
        if (!storedCampaign || ignore) return
        const asset = storedCampaign.assets.find((entry) => entry.assetKey === "construction_image")
        if (!asset?.fileUrl) return
        setCampaign(storedCampaign)
        setGeneratedImageUrl(asset.fileUrl)
        setResultVersion(storedCampaign.version)
        setApprovedVersion(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? storedCampaign.version : null)
        if (storedCampaign.visualIdentity) {
          setSelectedStyle(storedCampaign.visualIdentity as StudioStyle)
        }
        setCurrentStep(storedCampaign.status === "APPROVED" || storedCampaign.status === "PUBLISHED" ? "approval" : "result")
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [selectedPropertyId])

  useEffect(() => {
    if (!selectedProperty) return

    if (!availableImages.includes(selectedImage)) {
      setSelectedImage(availableImages[0] ?? "")
    }
  }, [availableImages, selectedImage, selectedProperty])

  const canAdvanceToConfiguration = Boolean(selectedProperty)
  const canProcess = Boolean(selectedProperty && selectedImage) && !isSubmitting
  const selectedImageLabel = useMemo(() => {
    if (!selectedProperty || !selectedImage) return "Imagem não selecionada"
    const index = availableImages.findIndex((image) => image === selectedImage)
    return index >= 0 ? `Imagem ${index + 1}` : "Imagem selecionada"
  }, [availableImages, selectedImage, selectedProperty])

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    setSelectedImage("")
    setResultVersion(0)
    setApprovedVersion(null)
    setGeneratedImageUrl("")
    setGenerationError("")
    setCurrentStep("selection")
  }

  function handleSelectImage(image: string) {
    setSelectedImage(image)
    setResultVersion(0)
    setApprovedVersion(null)
    setGeneratedImageUrl("")
    setGenerationError("")
  }

  function goToConfiguration() {
    if (!canAdvanceToConfiguration) return
    setCurrentStep("configuration")
  }

  async function startProcessing() {
    if (!canProcess) return
    setGenerationError("")
    setCurrentStep("processing")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/studio-ia/construction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          imageUrl: selectedImage,
          style: selectedStyle,
        }),
      })

      const data = (await response.json().catch(() => null)) as { error?: string; imageUrl?: string; campaign?: StudioCampaignRecord } | null

      if (!response.ok || !data) {
        throw new Error(data?.error || "Não foi possível gerar a imagem final do imóvel.")
      }

      const parsed = studioGenerationResponseSchema.parse(data)
      setGeneratedImageUrl(parsed.imageUrl)
      if (data.campaign) setCampaign(data.campaign)
      setResultVersion((current) => current + 1)
      setApprovedVersion(null)
      setCurrentStep("result")
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível gerar a imagem final do imóvel.")
      setCurrentStep("configuration")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function approveResult() {
    if (!campaign || !resultVersion) return
    const nextCampaign = await studioCampaignsClient.approveCampaign(campaign.id)
    setCampaign(nextCampaign)
    setApprovedVersion(nextCampaign.version)
    setCurrentStep("approval")
  }

  async function generateAnotherVersion() {
    if (!canProcess) return
    setApprovedVersion(null)
    await startProcessing()
  }

  function restartFlow() {
    setCampaign(null)
    setCurrentStep("selection")
    setResultVersion(0)
    setApprovedVersion(null)
    setGeneratedImageUrl("")
    setGenerationError("")
  }

  const visualSummary = useMemo(
    () => [
      {
        label: "Objetivo",
        value: "Transformar obra em imóvel pronto",
      },
      {
        label: "Estilo",
        value: selectedStyle,
      },
      {
        label: "Versão",
        value: resultVersion > 0 ? `${resultVersion}` : "Ainda não gerada",
      },
    ],
    [resultVersion, selectedStyle],
  )

  return (
    <BrokerPageShell title="Studio IA">
      <div className="min-w-0 grid gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Sparkles className="size-3.5" />
                Primeiro fluxo real
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Transformar obra em imóvel pronto</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Selecione um imóvel, escolha a imagem de base, defina o estilo visual e acompanhe a geração real até a aprovação do resultado.
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
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                <Link href="/corretor/corretor-m">
                  <MessageCircle className="size-4" />
                  Abrir Assessor EME atual
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
                O Studio fica concentrado neste único fluxo para manter a implementação inicial enxuta.
              </p>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Home className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Transformar obra em imóvel pronto</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      O resultado parte de uma imagem real do imóvel e gera uma versão final no estilo escolhido.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
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
                        aria-label="Imóvel para preparação"
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
                        <p className="text-sm font-medium text-[#050505]">Escolha uma imagem do imóvel</p>
                        {availableImages.length > 0 ? (
                          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {availableImages.map((image, index) => {
                              const active = image === selectedImage

                              return (
                                <button
                                  key={`${image}-${index}`}
                                  type="button"
                                  onClick={() => handleSelectImage(image)}
                                  className={`overflow-hidden rounded-[1.15rem] border text-left transition-all ${active ? "border-[#009b3a]/28 bg-white shadow-[0_10px_28px_rgba(0,155,58,0.08)]" : "border-black/[0.06] bg-white hover:border-black/[0.12]"}`}
                                >
                                  <div className="relative aspect-[4/3] bg-[#f2f4f7]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={image} alt={`Imagem ${index + 1} do imóvel`} className="h-full w-full object-cover" />
                                  </div>
                                  <div className="flex items-center justify-between px-3 py-3">
                                    <span className="text-sm font-medium text-[#050505]">Imagem {index + 1}</span>
                                    {active ? (
                                      <span className="rounded-full bg-[#009b3a] px-2.5 py-1 text-[11px] font-medium text-white">
                                        Selecionada
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-[1.15rem] border border-dashed border-black/[0.08] bg-white p-4 text-sm text-[#6B7280]">
                            Este imóvel ainda não possui imagens para este fluxo.
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-[#050505]">Escolha o estilo final</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {styleOptions.map((style) => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setSelectedStyle(style)}
                              className={`rounded-full border px-4 py-2 text-sm transition-colors ${selectedStyle === style ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>

                      {generationError ? (
                        <div className="rounded-[1.15rem] border border-[#d92d20]/12 bg-[#fff5f4] px-4 py-3 text-sm text-[#b42318]">
                          {generationError}
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        onClick={startProcessing}
                        disabled={!canProcess}
                        className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                      >
                        {isSubmitting ? "Gerando imagem final" : "Gerar imagem final"}
                        <Wand2 className="size-4" />
                      </Button>
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
            <CardContent className="grid min-w-0 gap-3 p-4 pt-0 sm:p-5 sm:pt-0">
              {visualSummary.map((item) => (
                <div key={item.label} className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-[#050505]">{item.value}</p>
                </div>
              ))}

              <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Imagem base</p>
                <p className="mt-2 text-sm font-semibold text-[#050505]">{selectedImageLabel}</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  A imagem selecionada é enviada como referência visual para a geração final.
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
                Acompanhe o estado da geração e aprove a versão escolhida.
              </p>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
              {currentStep === "processing" ? (
                <EmeLoading
                  message="Gerando transformação visual"
                  description={`Gerando a versão pronta do imóvel com estilo ${selectedStyle.toLowerCase()}.`}
                  className="min-h-[22rem] border border-[#009b3a]/18 bg-[#eef9f1]"
                />
              ) : currentStep === "result" || currentStep === "approval" ? (
                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-[#fbfbf8]">
                    <div className="grid min-w-0 gap-0 lg:grid-cols-2">
                      <div className="border-b border-black/[0.06] lg:border-r lg:border-b-0">
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="text-sm font-semibold text-[#050505]">Imagem original</p>
                          <span className="text-xs text-[#7B8491]">{selectedImageLabel}</span>
                        </div>
                        <div className="relative aspect-[4/3] bg-[#f2f4f7]">
                          {selectedImage ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={selectedImage} alt="Imagem original do imóvel" className="h-full w-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent px-4 py-4">
                                <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-medium text-[#050505]">
                                  Base atual da obra
                                </span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="text-sm font-semibold text-[#050505]">Resultado gerado</p>
                          <span className="rounded-full bg-[#009b3a] px-3 py-1 text-xs font-medium text-white">
                            Versão {resultVersion}
                          </span>
                        </div>
                        <div className="relative aspect-[4/3] bg-[#e7ecef]">
                          {generatedImageUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={generatedImageUrl}
                                alt="Resultado gerado do imóvel"
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_36%,rgba(0,0,0,0.14))]" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-4 py-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#050505]">
                                    Estilo {selectedStyle}
                                  </span>
                                  <span className="rounded-full bg-[#009b3a] px-3 py-1 text-xs font-medium text-white">
                                    Imóvel pronto
                                  </span>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-[1.25rem] border p-4 ${currentStep === "approval" ? "border-[#009b3a]/22 bg-[#eef9f1]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-[#050505]">
                          {currentStep === "approval" ? "Versão aprovada com sucesso" : "Resultado pronto para revisão"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {currentStep === "approval"
                            ? `A versão ${approvedVersion ?? resultVersion} foi aprovada no estilo ${selectedStyle.toLowerCase()}.`
                            : "Revise a geração visual e escolha se deseja aprovar ou gerar outra versão."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentStep !== "approval" ? (
                          <>
                            <Button
                              type="button"
                              onClick={approveResult}
                              className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]"
                            >
                              Aprovar
                              <CheckCircle2 className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={generateAnotherVersion}
                              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                            >
                              Gerar outra versão
                              <RefreshCcw className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={generateAnotherVersion}
                            className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                          >
                            Gerar outra versão
                            <RefreshCcw className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-6 text-center">
                  <ImagePlus className="size-8 text-[#8B95A1]" />
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Nenhum resultado gerado ainda</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7280]">
                    Avance pelas etapas de seleção e configuração para iniciar a geração visual desta transformação.
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
              ? "Geração em andamento"
              : step === "result"
                ? "Resultado"
                : "Aprovação",
      description: "O Studio executa apenas este fluxo de transformação visual nesta etapa do produto.",
    },
    {
      title: "Integrações",
      value: "Criação em andamento",
      description: "A imagem é preparada e guardada com segurança para você continuar o trabalho.",
    },
    {
      title: "Persistência",
      value: "Resultado preservado",
      description: "A imagem aprovada permanece disponível para as próximas ações do Studio.",
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
