"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bot,
  Building2,
  CheckCircle2,
  Clapperboard,
  Home,
  ImagePlus,
  Instagram,
  MessageCircle,
  Search,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StudioActionId =
  | "sell-property"
  | "instagram-campaign"
  | "property-video"
  | "construction-to-finished"
  | "attract-buyers"
  | "capture-owners"

type StudioState = "idle" | "preparing" | "ready"

const studioActions: Array<{
  id: StudioActionId
  title: string
  description: string
  icon: typeof Wand2
  resultLabel: string
  focusLabel: string
}> = [
  {
    id: "sell-property",
    title: "Vender este imovel",
    description: "Organize uma frente comercial focada em converter o imovel escolhido em oportunidade ativa.",
    icon: Target,
    resultLabel: "Plano comercial do imovel",
    focusLabel: "Venda direcionada",
  },
  {
    id: "instagram-campaign",
    title: "Criar campanha para Instagram",
    description: "Monte uma campanha visual para publicar o imovel com narrativa e gancho comercial.",
    icon: Instagram,
    resultLabel: "Campanha pronta para redes",
    focusLabel: "Instagram",
  },
  {
    id: "property-video",
    title: "Criar video do imovel",
    description: "Estruture um video com destaques, sequencia e proposta de apresentacao para o imovel.",
    icon: Clapperboard,
    resultLabel: "Roteiro de video",
    focusLabel: "Video comercial",
  },
  {
    id: "construction-to-finished",
    title: "Transformar obra em imovel pronto",
    description: "Prepare uma narrativa para apresentar potencial, acabamento imaginado e percepcao final.",
    icon: Home,
    resultLabel: "Enquadramento de obra pronta",
    focusLabel: "Transformacao visual",
  },
  {
    id: "attract-buyers",
    title: "Atrair compradores",
    description: "Defina uma abordagem de captacao para gerar interesse de compradores para o imovel selecionado.",
    icon: Search,
    resultLabel: "Frente de atracao",
    focusLabel: "Compradores",
  },
  {
    id: "capture-owners",
    title: "Captar proprietarios",
    description: "Monte uma proposta comercial inspirada no imovel escolhido para abrir novas captacoes.",
    icon: Building2,
    resultLabel: "Abordagem para captacao",
    focusLabel: "Proprietarios",
  },
] as const

const stateSteps: Record<StudioState, string[]> = {
  idle: [
    "Escolha uma acao principal",
    "Selecione um imovel existente",
    "Inicie o fluxo visual do Studio IA",
  ],
  preparing: [
    "Lendo contexto comercial do imovel",
    "Organizando angulo criativo e objetivo",
    "Montando estrutura inicial do resultado",
  ],
  ready: [
    "Acao preparada com sucesso",
    "Imovel vinculado ao fluxo visual",
    "Proxima etapa pronta para implementacao futura",
  ],
}

export function BrokerStudioIaPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedActionId, setSelectedActionId] = useState<StudioActionId>("sell-property")
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [studioState, setStudioState] = useState<StudioState>("idle")

  const publishedProperties = useMemo(
    () => properties.filter((property) => property.status === "Publicado"),
    [properties],
  )

  const propertyOptions = publishedProperties.length > 0 ? publishedProperties : properties

  useEffect(() => {
    if (!selectedPropertyId && propertyOptions[0]) {
      setSelectedPropertyId(propertyOptions[0].id)
    }
  }, [propertyOptions, selectedPropertyId])

  const selectedAction = useMemo(
    () => studioActions.find((action) => action.id === selectedActionId) ?? studioActions[0],
    [selectedActionId],
  )

  const selectedProperty = useMemo(
    () => propertyOptions.find((property) => property.id === selectedPropertyId) ?? null,
    [propertyOptions, selectedPropertyId],
  )

  useEffect(() => {
    if (studioState !== "preparing") return

    const timeoutId = window.setTimeout(() => {
      setStudioState("ready")
    }, 1100)

    return () => window.clearTimeout(timeoutId)
  }, [studioState])

  function handleSelectAction(actionId: StudioActionId) {
    setSelectedActionId(actionId)
    setStudioState("idle")
  }

  function handleSelectProperty(propertyId: string) {
    setSelectedPropertyId(propertyId)
    setStudioState("idle")
  }

  function handleStartFlow() {
    if (!selectedProperty) return
    setStudioState("preparing")
  }

  const canStart = Boolean(selectedProperty) && studioState !== "preparing"

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Sparkles className="size-3.5" />
                Studio orientado a resultado
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Escolha o resultado que voce quer gerar</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                O Studio IA comeca pelo objetivo comercial, depois conecta um imovel existente e prepara o fluxo visual de trabalho. Nenhuma API externa e acionada nesta etapa.
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.9fr)]">
          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Acoes principais</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Selecione a frente que melhor representa o resultado esperado.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0 md:grid-cols-2">
              {studioActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleSelectAction(action.id)}
                  className={`grid gap-3 rounded-[1.4rem] border p-4 text-left transition-all ${selectedAction.id === action.id ? "border-[#009b3a]/25 bg-[#eef9f1] shadow-[0_12px_28px_rgba(0,155,58,0.08)]" : "border-black/[0.06] bg-[#fbfbf8] hover:bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                      <action.icon className="size-5" />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${selectedAction.id === action.id ? "bg-[#009b3a] text-white" : "bg-white text-[#7B8491]"}`}>
                      {action.focusLabel}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#050505]">{action.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{action.description}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Fluxo visual</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Defina o imovel e veja o estado atual da preparacao.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Acao selecionada</p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                    <selectedAction.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#050505]">{selectedAction.title}</p>
                    <p className="mt-1 text-sm text-[#6B7280]">{selectedAction.resultLabel}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Escolher imovel</p>
                  <span className="text-xs text-[#7B8491]">
                    {propertyOptions.length} disponivel(is)
                  </span>
                </div>

                {isLoading ? (
                  <p className="mt-3 text-sm text-[#6B7280]">Carregando imoveis do corretor...</p>
                ) : propertyOptions.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    <select
                      value={selectedPropertyId}
                      onChange={(event) => handleSelectProperty(event.target.value)}
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
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#7B8491]">
                          <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1">{selectedProperty.type}</span>
                          <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1">{selectedProperty.purpose}</span>
                          <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1">{selectedProperty.price}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[1.15rem] border border-dashed border-black/[0.08] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-[#fbfbf8] text-[#8B95A1]">
                        <ImagePlus className="size-4.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#050505]">Nenhum imovel disponivel</p>
                        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                          Cadastre ou publique um imovel para iniciar qualquer fluxo do Studio IA.
                        </p>
                        <Button asChild className="mt-3 h-9 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]">
                          <Link href="/corretor/novo-imovel">Cadastrar imovel</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={handleStartFlow}
                disabled={!canStart}
                className="h-11 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:opacity-60"
              >
                {studioState === "preparing" ? "Preparando fluxo visual..." : "Iniciar fluxo"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Resultado preparado</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Visualizacao inicial do que o Studio vai organizar para esta acao.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className={`rounded-[1.3rem] border p-4 ${studioState === "ready" ? "border-[#009b3a]/22 bg-[#eef9f1]" : studioState === "preparing" ? "border-[#d5dae1] bg-[#f7f8fa]" : "border-black/[0.06] bg-[#fbfbf8]"}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Estado atual</p>
                    <p className="mt-2 text-lg font-semibold text-[#050505]">
                      {studioState === "idle" ? "Aguardando inicio" : studioState === "preparing" ? "Montando estrutura visual" : "Fluxo pronto para evoluir"}
                    </p>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      {selectedProperty
                        ? `${selectedAction.resultLabel} vinculado a ${selectedProperty.title}.`
                        : "Escolha um imovel para liberar o contexto do fluxo."}
                    </p>
                  </div>
                  <span className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium ${studioState === "ready" ? "bg-[#009b3a] text-white" : studioState === "preparing" ? "bg-white text-[#344054]" : "bg-white text-[#667085]"}`}>
                    {studioState === "idle" ? "Pronto para iniciar" : studioState === "preparing" ? "Em preparacao" : "Estrutura pronta"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <PreviewCard
                  title="Objetivo principal"
                  value={selectedAction.title}
                  description="Resultado comercial que vai guiar o proximo fluxo."
                  icon={Target}
                />
                <PreviewCard
                  title="Imovel base"
                  value={selectedProperty?.title ?? "Nao selecionado"}
                  description="Imovel escolhido para contextualizar a acao."
                  icon={Building2}
                />
                <PreviewCard
                  title="Proxima entrega"
                  value={selectedAction.resultLabel}
                  description="Primeiro artefato visual previsto para a jornada."
                  icon={Bot}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Etapas do estado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              {stateSteps[studioState].map((step, index) => (
                <div key={step} className="flex gap-3 rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-3">
                  <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${studioState === "ready" ? "bg-[#009b3a] text-white" : studioState === "preparing" && index === stateSteps[studioState].length - 1 ? "bg-white text-[#667085]" : "bg-white text-[#344054]"}`}>
                    {studioState === "ready" ? <CheckCircle2 className="size-3.5" /> : index + 1}
                  </div>
                  <p className="text-sm leading-6 text-[#5F6B7A]">{step}</p>
                </div>
              ))}

              <div className="rounded-[1.15rem] border border-dashed border-black/[0.08] bg-white p-4">
                <p className="text-sm leading-6 text-[#6B7280]">
                  Nesta versao, o Studio mostra somente o fluxo visual e seus estados. A execucao real das acoes entra nas proximas etapas.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setStudioState("idle")}
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                Reiniciar estado visual
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
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: typeof Bot
}) {
  return (
    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
        <Icon className="size-4.5" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{title}</p>
      <p className="mt-2 text-base font-semibold text-[#050505]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  )
}
