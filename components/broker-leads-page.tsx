"use client"

import Link from "next/link"
import { Clock3, MessageCircle, Sparkles, Trophy, UserRoundCheck, UsersRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const leadStages = [
  {
    title: "Leads novos",
    description: "Interessados capturados pelo catálogo e anúncios.",
    icon: UsersRound,
  },
  {
    title: "Em atendimento",
    description: "Contatos que precisam de resposta ou acompanhamento.",
    icon: MessageCircle,
  },
  {
    title: "Convertidos",
    description: "Oportunidades que avançaram para visita, proposta ou venda.",
    icon: Trophy,
  },
  {
    title: "Perdidos",
    description: "Clientes sem aderência ou sem retorno após atendimento.",
    icon: Clock3,
  },
]

export function BrokerLeadsPage() {
  const { properties } = useBrokerProperties()
  const totalLeads = properties.reduce((sum, property) => sum + Number(property.leads || 0), 0)
  const newLeads = totalLeads > 0 ? Math.max(1, Math.ceil(totalLeads * 0.35)) : 0
  const inProgress = totalLeads > 0 ? Math.max(1, Math.ceil(totalLeads * 0.25)) : 0
  const converted = totalLeads > 0 ? Math.max(0, Math.floor(totalLeads * 0.12)) : 0
  const lost = Math.max(0, totalLeads - newLeads - inProgress - converted)
  const values = [newLeads, inProgress, converted, lost]

  return (
    <BrokerPageShell title="Leads" primaryActionLabel="Novo imóvel" primaryActionHref="/corretor/novo-imovel">
      <div className="grid gap-6">
        <section className="rounded-[1.75rem] border border-[#00C853]/16 bg-[linear-gradient(135deg,rgba(0,200,83,0.14),rgba(17,17,17,0.96)_42%,rgba(14,14,14,0.92))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#69F0AE]">
                <Sparkles className="size-3.5" />
                Pipeline inteligente
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">Leads organizados para vender melhor</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                Aqui ficam os contatos capturados pelo catálogo, imóveis e ações inteligentes do EME.
              </p>
            </div>
            <Button asChild className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
              <Link href="/corretor/corretor-m">Analisar com Corretor M</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {leadStages.map((stage, index) => (
            <Card key={stage.title} className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
              <CardHeader className="px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                    <stage.icon className="size-5" />
                  </div>
                  <p className="text-3xl font-semibold text-white">{values[index]}</p>
                </div>
                <CardTitle className="pt-3 text-lg text-white">{stage.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <p className="text-sm leading-6 text-white/55">{stage.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] p-6">
          {totalLeads > 0 ? (
            <div className="grid gap-3">
              {properties
                .filter((property) => Number(property.leads || 0) > 0)
                .slice(0, 6)
                .map((property) => (
                  <div key={property.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{property.title}</p>
                      <p className="mt-1 text-sm text-white/45">
                        {property.leads} lead{Number(property.leads) === 1 ? "" : "s"} capturado{Number(property.leads) === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium text-[#69F0AE]">
                      <UserRoundCheck className="size-3.5" />
                      Pronto para atendimento
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <UsersRound className="size-6" />
              </div>
              <h3 className="text-xl font-semibold text-white">Nenhum lead recebido ainda.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
                Publique imóveis no catálogo inteligente para começar a capturar interessados com contexto.
              </p>
            </div>
          )}
        </section>
      </div>
    </BrokerPageShell>
  )
}
