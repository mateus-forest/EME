"use client"

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

type StudioStep = "selection" | "checklist" | "operation" | "readiness"
type CommercialFlowKey = "construction" | "instagram" | "video" | "buyers" | "owners"

type CommercialFlow = {
  key: CommercialFlowKey
  title: string
  description: string
  href?: string
  icon: typeof Home
  isAvailable: boolean
}

const stepLabels: Array<{ id: StudioStep; label: string }> = [
  { id: "selection", label: "Selecao" },
  { id: "checklist", label: "Checklist" },
  { id: "operation", label: "Central" },
  { id: "readiness", label: "Pronto" },
]

const commercialFlows: CommercialFlow[] = [
  {
    key: "construction",
    title: "Transformar obra em imovel pronto",
    description: "Prepare a imagem comercial final quando o ativo ainda estiver em obra.",
    href: "/corretor/studio-ia/transformar-obra-em-imovel-pronto",
    icon: Sparkles,
    isAvailable: true,
  },
  {
    key: "instagram",
    title: "Criar campanha para Instagram",
    description: "Organize feed, story, carrossel, legenda, CTA e hashtags do imovel.",
    href: "/corretor/studio-ia/criar-campanha-instagram",
    icon: Instagram,
    isAvailable: true,
  },
  {
    key: "video",
    title: "Criar video do imovel",
    description: "Estruture a frente audiovisual da divulgacao comercial.",
    icon: Video,
    isAvailable: false,
  },
  {
    key: "buyers",
    title: "Atrair compradores",
    description: "Planeje a captacao de demanda para acelerar a operacao comercial.",
    href: "/corretor/studio-ia/atrair-compradores",
    icon: Users,
    isAvailable: true,
  },
  {
    key: "owners",
    title: "Captar proprietarios",
    description: "Amplie o potencial comercial do corretor com novos ativos e relacionamento.",
    icon: Home,
    isAvailable: false,
  },
]

export function BrokerStudioIaSellPropertyPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [currentStep, setCurrentStep] = useState<StudioStep>("selection")
  const [completedFlows, setCompletedFlows] = useState<Record<CommercialFlowKey, boolean>>({
    construction: false,
    instagram: false,
    video: false,
    buyers: false,
    owners: false,
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

  const availableFlows = useMemo(
    () => commercialFlows.filter((flow) => flow.isAvailable),
    [],
  )

  const availableCompletedCount = availableFlows.filter((flow) => completedFlows[flow.key]).length
  const pendingFlowsCount = commercialFlows.filter((flow) => !completedFlows[flow.key]).length
  const isReadyForOperation = availableCompletedCount === availableFlows.length

  const visualSummary = useMemo(
    () => [
      {
        label: "Imovel selecionado",
        value: selectedProperty?.title ?? "Nenhum imovel selecionado",
      },
      {
        label: "Fluxos concluidos",
        value: `${availableCompletedCount} de ${availableFlows.length} disponiveis`,
      },
      {
        label: "Ultima atualizacao",
        value: buildLastUpdateLabel(availableCompletedCount),
      },
    ],
    [availableCompletedCount, availableFlows.length, selectedProperty],
  )

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    setCurrentStep("selection")
    setCompletedFlows({
      construction: false,
      instagram: false,
      video: false,
      buyers: false,
      owners: false,
    })
  }

  function toggleFlowCompletion(flowKey: CommercialFlowKey) {
    setCompletedFlows((current) => ({
      ...current,
      [flowKey]: !current[flowKey],
    }))
  }

  function restartFlow() {
    setCompletedFlows({
      construction: false,
      instagram: false,
      video: false,
      buyers: false,
      owners: false,
    })
    setCurrentStep("selection")
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <PlayCircle className="size-3.5" />
                Orquestrador Studio IA
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Vender este imovel</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Centralize a preparacao comercial do imovel, acompanhe os fluxos disponiveis e organize a operacao antes de iniciar a divulgacao.
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Fluxo visual</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                O Studio organiza a venda do imovel em uma trilha unica, pronta para incorporar automacao futura.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <Home className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Vender este imovel</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      Centralize todos os materiais e fluxos essenciais para preparar a operacao comercial do ativo.
                    </p>
                  </div>
                </div>
              </div>

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
                              <InfoTile label="Endereco" value={`${selectedProperty.neighborhood}, ${selectedProperty.city}`} />
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
                      Avancar para checklist
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <EmptyPropertiesState />
                )}
              </div>

              <div className={`rounded-[1.25rem] border p-4 ${currentStep === "selection" ? "border-black/[0.06] bg-[#f6f7f4] opacity-65" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">2. Checklist de preparacao comercial</p>
                  <span className="text-xs text-[#7B8491]">{availableCompletedCount} concluido(s)</span>
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
                    Abrir Central de Operacao
                    <ArrowRight className="size-4" />
                  </Button>
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
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Central de Operacao</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Painel simulado para acompanhar o preparo comercial e os materiais gerados antes da operacao.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoMetric
                  label="Preparacao comercial"
                  value={`${Math.round((availableCompletedCount / availableFlows.length) * 100)}%`}
                  description="Percentual simulado dos fluxos disponiveis ja organizados."
                />
                <InfoMetric
                  label="Materiais gerados"
                  value={availableCompletedCount > 0 ? `${availableCompletedCount + 1}` : "1"}
                  description="Contagem simulada considerando campanha, imagens e ativos comerciais."
                />
                <InfoMetric
                  label="Fluxos concluidos"
                  value={`${availableCompletedCount}`}
                  description="Fluxos ja marcados como prontos dentro deste orquestrador."
                />
                <InfoMetric
                  label="Fluxos pendentes"
                  value={`${pendingFlowsCount}`}
                  description="Itens ainda nao finalizados ou aguardando implementacao futura."
                />
                <InfoMetric
                  label="Ultima atualizacao"
                  value={buildLastUpdateLabel(availableCompletedCount)}
                  description="Referencia simulada para a ultima revisao da operacao comercial."
                />
              </div>

              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-[#050505]">Validacao da operacao comercial</p>
                    <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                      {isReadyForOperation
                        ? "Todos os fluxos disponiveis ja foram concluidos. O imovel pode avancar para prontidao comercial."
                        : "Conclua os fluxos disponiveis para liberar a etapa final de prontidao."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setCurrentStep("readiness")}
                    disabled={!isReadyForOperation}
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                  >
                    Validar prontidao
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>

              {currentStep === "readiness" ? (
                <div className="rounded-[1.35rem] border border-[#009b3a]/22 bg-[#eef9f1] p-5">
                  <p className="text-lg font-semibold text-[#050505]">Este imovel esta pronto para iniciar sua operacao comercial.</p>
                  <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                    Todos os fluxos disponiveis do Studio IA foram organizados para este ativo nesta simulacao do orquestrador.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCurrentStep("checklist")}
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
                  <p className="mt-4 text-lg font-semibold text-[#050505]">Prontidao comercial em preparacao</p>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                    Conclua as acoes disponiveis do checklist para liberar a mensagem final deste orquestrador.
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
              {buildStatusItems(currentStep, isReadyForOperation).map((item) => (
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
                {completed ? "Concluido" : flow.isAvailable ? "Disponivel" : "Em breve"}
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
              {completed ? "Marcar pendente" : "Marcar concluido"}
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

function buildLastUpdateLabel(completedCount: number) {
  if (completedCount >= 2) return "Agora mesmo"
  if (completedCount === 1) return "Ha poucos minutos"
  return "Aguardando preparacao"
}

function stepOrder(step: StudioStep) {
  if (step === "selection") return 0
  if (step === "checklist") return 1
  if (step === "operation") return 2
  return 3
}

function buildStatusItems(step: StudioStep, isReadyForOperation: boolean) {
  return [
    {
      title: "Etapa atual",
      value:
        step === "selection"
          ? "Selecao"
          : step === "checklist"
            ? "Checklist"
            : step === "operation"
              ? "Central de Operacao"
              : "Prontidao comercial",
      description: "O Studio organiza a venda do imovel em uma sequencia unica para futura automacao completa.",
    },
    {
      title: "Integracoes",
      value: "Fluxos conectados por navegacao",
      description: "Os fluxos ja existentes abrem suas rotas proprias e os demais permanecem sinalizados como em breve.",
    },
    {
      title: "Prontidao",
      value: isReadyForOperation ? "Liberada" : "Em andamento",
      description: "A etapa final e habilitada apenas quando todos os fluxos disponiveis forem marcados como concluidos.",
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
