"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BarChart3, Eye, MessageCircle, MousePointerClick, SlidersHorizontal, TrendingUp, UsersRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type BrokerAnalytics = {
  totalViews: number
  whatsappClicks: number
  leads: number
  monitoredProperties: number
  mostAccessed: Array<{ id: string; title: string; views: number; leads: number }>
  leadOrigins: Array<{ source: string; count: number }>
}

export function BrokerAnalyticsPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [analytics, setAnalytics] = useState<BrokerAnalytics | null>(null)
  const totalViews = analytics?.totalViews ?? properties.reduce((sum, property) => sum + toNumber(property.views), 0)
  const totalLeads = analytics?.leads ?? properties.reduce((sum, property) => sum + toNumber(property.leads), 0)
  const whatsappClicks = analytics?.whatsappClicks ?? 0
  const mostAccessed = analytics?.mostAccessed ?? [...properties].sort((first, second) => toNumber(second.views) - toNumber(first.views)).slice(0, 5)
  const hasProperties = properties.length > 0

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/analytics", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as BrokerAnalytics | null
        if (!ignore && response.ok && data) setAnalytics(data)
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  return (
    <BrokerPageShell
      title="Analytics"
      searchPlaceholder="Buscar imóvel ou bairro"
      searchValue=""
      onSearchChange={() => {}}
    >
      <div className="grid gap-5">
        {!hasProperties && !isLoading ? (
          <section className="rounded-[1.75rem] border border-[#00C853]/20 bg-[#00C853]/10 p-6 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
              <BarChart3 className="size-6" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-white">Analytics pronto para acompanhar</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/60">
              Cadastre imóveis para acompanhar visualizações do catálogo, cliques no WhatsApp, leads recebidos e imóveis mais acessados.
            </p>
            <Button asChild className="mt-6 h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
              <Link href="/corretor/novo-imovel">Cadastrar imóvel</Link>
            </Button>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Eye} label="Visualizações do catálogo" value={totalViews.toLocaleString("pt-BR")} />
          <MetricCard icon={MousePointerClick} label="Cliques no WhatsApp" value={String(whatsappClicks)} />
          <MetricCard icon={UsersRound} label="Leads recebidos" value={totalLeads.toLocaleString("pt-BR")} />
          <MetricCard icon={TrendingUp} label="Imóveis monitorados" value={String(analytics?.monitoredProperties ?? properties.length)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <BarChart3 className="size-5 text-[#69F0AE]" />
                Imóveis mais acessados
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {mostAccessed.length > 0 ? mostAccessed.map((property) => (
                <div key={property.id} className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                  <p className="truncate text-sm font-medium text-white">{property.title}</p>
                  <span className="text-sm text-white/60">{typeof property.views === "number" ? property.views : toNumber(property.views)} visualizações</span>
                  <span className="text-sm text-[#69F0AE]">{typeof property.leads === "number" ? property.leads : toNumber(property.leads)} leads</span>
                </div>
              )) : (
                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">
                  Nenhum imóvel cadastrado para ranquear.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <SlidersHorizontal className="size-5 text-[#69F0AE]" />
                Filtros e origem
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <InfoBlock label="Filtro atual" value="Todos os imóveis" />
              <InfoBlock label="Origem dos leads" value={totalLeads > 0 ? "Catálogo e imóveis publicados" : "Sem origem registrada"} />
              <InfoBlock label="WhatsApp" value={`${whatsappClicks} cliques registrados`} />
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <MessageCircle className="size-5 text-[#69F0AE]" />
              Origem dos leads
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0 md:grid-cols-3">
            <InfoBlock label="Catálogo" value={totalLeads > 0 ? `${totalLeads} leads` : "0 leads"} />
            <InfoBlock label="WhatsApp" value={`${whatsappClicks} cliques registrados`} />
            <InfoBlock label="Outras origens" value="Sem dados registrados" />
          </CardContent>
        </Card>
      </div>
    </BrokerPageShell>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="p-5">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-4.5" />
        </div>
        <p className="mt-4 text-sm text-white/50">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}
