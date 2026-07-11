"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Home,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  { id: "selection", label: "Selecao" },
  { id: "configuration", label: "Configuracao" },
  { id: "processing", label: "Processamento" },
  { id: "result", label: "Resultado" },
  { id: "approval", label: "Aprovacao" },
]

export function BrokerStudioIaPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedImage, setSelectedImage] = useState("")
  const [selectedStyle, setSelectedStyle] = useState<StudioStyle>("Moderno")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null)

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
    if (!selectedProperty) return

    if (!availableImages.includes(selectedImage)) {
      setSelectedImage(availableImages[0] ?? "")
    }
  }, [availableImages, selectedImage, selectedProperty])

  useEffect(() => {
    if (currentStep !== "processing") return

    const timeoutId = window.setTimeout(() => {
      setResultVersion((current) => current + 1)
      setApprovedVersion(null)
      setCurrentStep("result")
    }, 1600)

    return () => window.clearTimeout(timeoutId)
  }, [currentStep])

  const canAdvanceToConfiguration = Boolean(selectedProperty)
  const canProcess = Boolean(selectedProperty && selectedImage)
  const selectedImageLabel = useMemo(() => {
    if (!selectedProperty || !selectedImage) return "Imagem nao selecionada"
    const index = availableImages.findIndex((image) => image === selectedImage)
    return index >= 0 ? `Imagem ${index + 1}` : "Imagem selecionada"
  }, [availableImages, selectedImage, selectedProperty])

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    setSelectedImage("")
    setResultVersion(0)
    setApprovedVersion(null)
    setCurrentStep("selection")
  }

  function handleSelectImage(image: string) {
    setSelectedImage(image)
    setResultVersion(0)
    setApprovedVersion(null)
  }

  function goToConfiguration() {
    if (!canAdvanceToConfiguration) return
    setCurrentStep("configuration")
  }

  function startProcessing() {
    if (!canProcess) return
    setCurrentStep("processing")
  }

  function approveResult() {
    if (!resultVersion) return
    setApprovedVersion(resultVersion)
    setCurrentStep("approval")
  }

  function generateAnotherVersion() {
    if (!canProcess) return
    setCurrentStep("processing")
  }

  function restartFlow() {
    setCurrentStep("selection")
    setResultVersion(0)
    setApprovedVersion(null)
  }

  const visualSummary = useMemo(
    () => [
      {
        label: "Objetivo",
        value: "Transformar obra em imovel pronto",
      },
      {
        label: "Estilo",
        value: selectedStyle,
      },
      {
        label: "Versao",
        value: resultVersion > 0 ? `${resultVersion}` : "Ainda nao gerada",
      },
    ],
    [resultVersion, selectedStyle],
  )

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Sparkles className="size-3.5" />
                Primeiro fluxo real
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Transformar obra em imovel pronto</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Selecione um imovel, escolha a imagem de base, defina o estilo visual e acompanhe o processamento simulado ate a aprovacao do resultado.
              </p>
            </div>
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
                O Studio fica concentrado neste unico fluxo para manter a implementacao inicial enxuta.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Home className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Transformar obra em imovel pronto</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      O resultado simulado parte de uma imagem real do imovel e projeta uma versao final no estilo escolhido.
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
                        <p className="text-sm font-medium text-[#050505]">Escolha uma imagem do imovel</p>
                        {availableImages.length > 0 ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                                    <img src={image} alt={`Imagem ${index + 1} do imovel`} className="h-full w-full object-cover" />
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
                            Este imovel ainda nao possui imagens para este fluxo.
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

                      <Button
                        type="button"
                        onClick={startProcessing}
                        disabled={!canProcess}
                        className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                      >
                        Iniciar processamento simulado
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Imagem base</p>
                <p className="mt-2 text-sm font-semibold text-[#050505]">{selectedImageLabel}</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  O processamento continua totalmente simulado nesta etapa.
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
                Acompanhe o estado do processamento simulado e aprove a versao escolhida.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              {currentStep === "processing" ? (
                <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-[1.35rem] border border-[#009b3a]/18 bg-[#eef9f1] px-6 text-center">
                  <LoaderCircle className="size-8 animate-spin text-[#009b3a]" />
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Processando transformacao visual</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#5F6B7A]">
                    Simulando a criacao da versao pronta do imovel com estilo {selectedStyle.toLowerCase()}.
                  </p>
                </div>
              ) : currentStep === "result" || currentStep === "approval" ? (
                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-[#fbfbf8]">
                    <div className="grid gap-0 lg:grid-cols-2">
                      <div className="border-b border-black/[0.06] lg:border-r lg:border-b-0">
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="text-sm font-semibold text-[#050505]">Imagem original</p>
                          <span className="text-xs text-[#7B8491]">{selectedImageLabel}</span>
                        </div>
                        <div className="relative aspect-[4/3] bg-[#f2f4f7]">
                          {selectedImage ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={selectedImage} alt="Imagem original do imovel" className="h-full w-full object-cover" />
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
                          <p className="text-sm font-semibold text-[#050505]">Resultado simulado</p>
                          <span className="rounded-full bg-[#009b3a] px-3 py-1 text-xs font-medium text-white">
                            Versao {resultVersion}
                          </span>
                        </div>
                        <div className="relative aspect-[4/3] bg-[#e7ecef]">
                          {selectedImage ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={selectedImage}
                                alt="Resultado simulado do imovel"
                                className="h-full w-full object-cover saturate-[1.08] contrast-[1.02] brightness-[1.03]"
                              />
                              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_36%,rgba(0,0,0,0.14))]" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-4 py-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#050505]">
                                    Estilo {selectedStyle}
                                  </span>
                                  <span className="rounded-full bg-[#009b3a] px-3 py-1 text-xs font-medium text-white">
                                    Imovel pronto
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
                          {currentStep === "approval" ? "Versao aprovada com sucesso" : "Resultado pronto para revisao"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {currentStep === "approval"
                            ? `A versao ${approvedVersion ?? resultVersion} foi aprovada no estilo ${selectedStyle.toLowerCase()}.`
                            : "Revise a simulacao visual e escolha se deseja aprovar ou gerar outra versao."}
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
                              Gerar outra versao
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
                            Gerar outra versao
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
                    Avance pelas etapas de selecao e configuracao para iniciar a simulacao visual desta transformacao.
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
              ? "Processamento simulado"
              : step === "result"
                ? "Resultado"
                : "Aprovacao",
      description: "O Studio mostra apenas a evolucao visual deste fluxo nesta etapa do produto.",
    },
    {
      title: "Integracoes",
      value: "Nao conectadas",
      description: "Luma, OpenAI e demais APIs continuam fora do escopo desta implementacao.",
    },
    {
      title: "Persistencia",
      value: "Sem salvar em banco",
      description: "Todas as decisoes e estados existem apenas na interface atual.",
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
