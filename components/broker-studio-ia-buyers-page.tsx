"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  LoaderCircle,
  Megaphone,
  RefreshCcw,
  Users,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

const audienceOptions: AudienceProfile[] = ["Primeiro imovel", "Familia", "Investidor", "Alto padrao", "Imovel de praia", "Comercial"]
const channelOptions: MainChannel[] = ["Instagram", "Facebook", "Google", "WhatsApp", "Portais imobiliarios"]

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Selecao" },
  { id: "configuration", label: "Configuracao" },
  { id: "processing", label: "Processamento" },
  { id: "result", label: "Resultado" },
  { id: "approval", label: "Aprovacao" },
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

  useEffect(() => {
    if (!selectedPropertyId && propertyOptions[0]) {
      setSelectedPropertyId(propertyOptions[0].id)
    }
  }, [propertyOptions, selectedPropertyId])

  useEffect(() => {
    if (currentStep !== "processing") return

    const timeoutId = window.setTimeout(() => {
      const nextVersion = resultVersion + 1
      setPreview(buildBuyerStrategyPreview({
        propertyTitle: selectedProperty?.title ?? "Imovel em destaque",
        city: selectedProperty?.city ?? "sua cidade",
        neighborhood: selectedProperty?.neighborhood ?? "bairro estrategico",
        audience: selectedAudience,
        channel: selectedChannel,
        version: nextVersion,
      }))
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
      setIsSubmitting(false)
      setCurrentStep("result")
    }, 1600)

    return () => window.clearTimeout(timeoutId)
  }, [currentStep, resultVersion, selectedAudience, selectedChannel, selectedProperty])

  const canAdvanceToConfiguration = Boolean(selectedProperty)
  const canProcess = Boolean(selectedProperty) && !isSubmitting
  const approvedBlocksCount = Object.values(approvedBlocks).filter(Boolean).length

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

  function toggleBlockApproval(block: StrategyBlockKey) {
    setApprovedBlocks((current) => ({
      ...current,
      [block]: !current[block],
    }))
  }

  function approveStrategy() {
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
      { label: "Publico", value: selectedAudience },
      { label: "Canal principal", value: selectedChannel },
      { label: "Versao", value: resultVersion > 0 ? `${resultVersion}` : "Ainda nao gerada" },
    ],
    [resultVersion, selectedAudience, selectedChannel],
  )

  const coverImage = selectedProperty?.images[0] ?? ""

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Users className="size-3.5" />
                Fluxo Studio IA
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Atrair compradores</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Selecione o imovel, defina o publico ideal, escolha o canal principal e gere uma estrategia simulada completa para atracao de interessados.
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
                O Studio reaproveita a mesma experiencia em etapas para evoluir depois para estrategia automatizada com IA.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Megaphone className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Atrair compradores</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      Organize publico, canal e mensagem principal para preparar a estrategia comercial do imovel.
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
                                <InfoTile label="Localizacao" value={`${selectedProperty.neighborhood}, ${selectedProperty.city}`} />
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
                        <p className="text-sm font-medium text-[#050505]">Escolha o perfil do publico</p>
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
                        {isSubmitting ? "Gerando estrategia" : "Gerar estrategia"}
                        <ArrowRight className="size-4" />
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Aprovacoes da estrategia</p>
                <p className="mt-2 text-sm font-semibold text-[#050505]">{approvedBlocksCount} de 7 blocos revisados</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  Cada bloco da estrategia pode ser aprovado individualmente para manter o mesmo padrao de revisao do Studio IA.
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
                Revise a estrategia simulada, aprove cada bloco e finalize a versao quando estiver pronta.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              {currentStep === "processing" ? (
                <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-[1.35rem] border border-[#009b3a]/18 bg-[#eef9f1] px-6 text-center">
                  <LoaderCircle className="size-8 animate-spin text-[#009b3a]" />
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Gerando estrategia simulada</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#5F6B7A]">
                    Montando a estrategia para {selectedAudience.toLowerCase()} com foco principal em {selectedChannel.toLowerCase()}.
                  </p>
                </div>
              ) : currentStep === "result" || currentStep === "approval" ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <PreviewCard
                      title="Publico recomendado"
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
                              <p className="mt-1 text-sm text-[#6B7280]">Perfil sugerido para o imovel selecionado.</p>
                            </div>
                          </div>
                        </div>
                      }
                    />

                    <PreviewCard
                      title="Estrategia sugerida"
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
                                <img src={coverImage} alt="Preview da estrategia" className="h-full w-full object-cover" />
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
                      title="Cronograma de divulgacao"
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
                      title="Estimativa de geracao de leads"
                      approved={approvedBlocks.leads}
                      onApprove={() => toggleBlockApproval("leads")}
                      content={<MetricPreview value={preview?.leads ?? "--"} description="Estimativa simulada de interessados qualificados gerados pela estrategia." />}
                    />
                  </div>

                  <div className={`rounded-[1.25rem] border p-4 ${currentStep === "approval" ? "border-[#009b3a]/22 bg-[#eef9f1]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-[#050505]">
                          {currentStep === "approval" ? "Estrategia aprovada com sucesso" : "Estrategia pronta para revisao"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          {currentStep === "approval"
                            ? `A estrategia versao ${approvedVersion ?? resultVersion} foi aprovada para ${selectedAudience.toLowerCase()} no canal ${selectedChannel.toLowerCase()}.`
                            : "Revise os blocos da estrategia, aprove os itens desejados e finalize ou gere outra versao."}
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
                              Aprovar estrategia
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
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Nenhuma estrategia gerada ainda</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7280]">
                    Avance pelas etapas de selecao e configuracao para iniciar a geracao simulada desta estrategia.
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

function buildBuyerStrategyPreview({
  propertyTitle,
  city,
  neighborhood,
  audience,
  channel,
  version,
}: {
  propertyTitle: string
  city: string
  neighborhood: string
  audience: AudienceProfile
  channel: MainChannel
  version: number
}): BuyerStrategyPreview {
  return {
    audience: `${audience} com interesse em ${propertyTitle} na regiao de ${neighborhood}`,
    strategy: `Priorize uma comunicacao direcionada para ${audience.toLowerCase()} utilizando ${channel.toLowerCase()} como canal principal, com destaque para localizacao, percepcao de valor e oportunidade de contato rapido.`,
    copy: `${propertyTitle} em ${city} pode ser apresentado com uma mensagem objetiva e comercial, destacando conveniencia, potencial de compra e diferenciais do ativo para atrair ${audience.toLowerCase()} desde a primeira interacao.`,
    cta: channel === "WhatsApp" ? "Fale agora no WhatsApp e receba os detalhes" : "Clique para receber mais informacoes e agendar atendimento",
    timeline: [
      `Dia 1: publicar a primeira mensagem no canal ${channel.toLowerCase()} e validar resposta inicial.`,
      "Dia 3: reforcar diferenciais e prova de oportunidade com nova rodada de divulgacao.",
      `Dia 5: retargeting comercial com foco em conversao para ${audience.toLowerCase()}.`,
    ],
    reach: buildReachEstimate(channel, version),
    leads: buildLeadEstimate(audience, version),
  }
}

function buildReachEstimate(channel: MainChannel, version: number) {
  if (channel === "Google") return `${1800 + version * 120} pessoas`
  if (channel === "Instagram") return `${2400 + version * 150} pessoas`
  if (channel === "Facebook") return `${1600 + version * 110} pessoas`
  if (channel === "WhatsApp") return `${420 + version * 30} contatos`
  return `${3100 + version * 180} visualizacoes`
}

function buildLeadEstimate(audience: AudienceProfile, version: number) {
  if (audience === "Investidor") return `${18 + version} leads`
  if (audience === "Alto padrao") return `${10 + version} leads`
  if (audience === "Comercial") return `${12 + version} leads`
  return `${22 + version} leads`
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
      description: "O Studio reaproveita a mesma jornada por etapas para evoluir depois com geracao automatica de estrategia.",
    },
    {
      title: "Integracoes",
      value: "Simuladas",
      description: "A estrategia ainda nao usa IA nem APIs externas. Todo o conteudo e montado localmente na interface.",
    },
    {
      title: "Persistencia",
      value: "Sem alterar banco",
      description: "As aprovacoes e versoes desta estrategia existem apenas na sessao atual, preservando a arquitetura do portal.",
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
