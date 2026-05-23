"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bot, CheckCircle2, Lightbulb, MessageCircle, Search, UsersRound, Zap } from "lucide-react"

import type { BrokerProperty } from "@/components/use-broker-properties"
import type { BrokerSubscription } from "@/components/use-broker-subscription"
import type { LeadRecord } from "@/lib/lead-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type AssistantCredits = {
  balance: number
  usedThisMonth: number
}

type BrokerIntelligenceDashboardProps = {
  properties: BrokerProperty[]
  subscription: BrokerSubscription
}

type SearchEventItem = {
  id: string
  query: string
  resultCount: number
  source: string
  createdAt: string
}

export function BrokerIntelligenceDashboard({ properties, subscription }: BrokerIntelligenceDashboardProps) {
  const [credits, setCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true)
  const [recentSearches, setRecentSearches] = useState<SearchEventItem[]>([])

  useEffect(() => {
    let ignore = false

    fetch("/api/ai/broker-assistant", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { credits?: AssistantCredits } | null
        if (!ignore && response.ok && data?.credits) setCredits(data.credits)
      })
      .catch(() => null)

    fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[] } | null
        if (!ignore && response.ok && data?.leads) setLeads(data.leads)
      })
      .catch(() => null)

    fetch("/api/brokers/analytics", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { recentSearches?: SearchEventItem[] } | null
        if (!ignore && response.ok && data?.recentSearches) setRecentSearches(data.recentSearches)
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  const leadMetrics = useMemo(
    () => ({
      received: leads.length,
      new: leads.filter((lead) => lead.status === "NEW").length,
      pending: leads.filter((lead) => lead.status === "NEW" || lead.status === "CONTACTED").length,
      converted: leads.filter((lead) => lead.status === "WON").length,
    }),
    [leads],
  )
  const searchTerms = useMemo(
    () => {
      const tracked = recentSearches.map((item) => item.query.trim()).filter(Boolean)
      const fromLeads = leads.map((lead) => lead.searchTerm.trim()).filter(Boolean)
      return Array.from(new Set([...tracked, ...fromLeads])).slice(0, 3)
    },
    [leads, recentSearches],
  )
  const recentLeads = leads.slice(0, 3)
  const remainingEstimate = Math.max(0, credits.balance)
  const actionsCount = credits.usedThisMonth
  const currentPackage = subscription.isUpgraded ? "Assessor EME Pro" : "Assessor EME inicial"
  const recommendedActions = [
    properties.length === 0 ? "Publique seu primeiro imóvel no catálogo inteligente." : "",
    leads.length === 0 ? "Compartilhe seu catálogo para começar a capturar leads." : "",
    credits.balance === 0 ? "Adicione créditos IA para usar o Assessor EME." : "",
  ].filter(Boolean)

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="overflow-hidden rounded-[1.75rem] border-[#00C853]/18 bg-[linear-gradient(135deg,rgba(0,200,83,0.16),rgba(17,17,17,0.96)_42%,rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#69F0AE]">
                  <Bot className="size-3.5" />
                  IA viva
                </div>
                <CardTitle className="mt-4 text-2xl text-white">Assessor EME</CardTitle>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/58">
                  Canal oficial do EME para criar anúncios, analisar leads, melhorar catálogo e pedir apoio operacional.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAiAssistantEnabled((current) => !current)}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 text-white/80 hover:bg-white/[0.08] hover:text-white"
              >
                {aiAssistantEnabled ? "Desativar" : "Ativar"} Assessor EME
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Status" value={aiAssistantEnabled ? "Ativo" : "Pausado"} tone={aiAssistantEnabled ? "green" : "muted"} />
            <Metric label="Créditos IA" value={String(credits.balance)} />
            <Metric label="Uso no mês" value={String(credits.usedThisMonth)} />
            <Metric label="Ações IA" value={actionsCount > 0 ? String(actionsCount) : "Aguardando uso"} />
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4 sm:col-span-2 xl:col-span-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Última interação</p>
              <p className="mt-2 text-sm text-white/68">
                {actionsCount > 0 ? "Ação registrada neste mês." : "O Assessor EME ainda não realizou ações."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-[#25D366]/20 bg-[linear-gradient(180deg,rgba(18,28,22,0.9),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-[#25D366]/20 bg-[#25D366]/12 text-[#25D366]">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-white">Assessor EME no WhatsApp</CardTitle>
                <p className="mt-1 text-sm text-[#25D366]">Canal oficial do sistema</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-2xl font-semibold text-white">Canal oficial EME</p>
            <p className="mt-3 text-sm leading-6 text-white/58">
              Use este canal para falar com a IA do EME e solicitar tarefas operacionais. O número oficial será informado nos canais de atendimento.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <UsersRound className="size-5 text-[#69F0AE]" />
              Leads recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {leadMetrics.received > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Recebidos" value={String(leadMetrics.received)} />
                  <Metric label="Novos" value={String(leadMetrics.new)} />
                  <Metric label="Aguardando resposta" value={String(leadMetrics.pending)} />
                  <Metric label="Convertidos" value={String(leadMetrics.converted)} />
                </div>
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <p className="text-sm font-medium text-white">{lead.name || "Lead sem nome"}</p>
                    <p className="mt-1 text-xs text-white/45">{lead.propertyTitle || "Catálogo"} · {lead.statusLabel}</p>
                  </div>
                ))}
              </>
            ) : (
              <EmptyState text="Nenhum lead recebido ainda. Compartilhe seu catálogo para começar." />
            )}
            <Button asChild variant="ghost" className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white">
              <Link href="/corretor/leads">Ver leads</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <Search className="size-5 text-[#69F0AE]" />
              Buscas dos clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {searchTerms.length > 0 ? (
              searchTerms.map((query) => (
                <div key={query} className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <p className="text-sm font-medium text-white">{query}</p>
                  <p className="mt-1 text-xs text-white/45">Termo pesquisado no catálogo.</p>
                </div>
              ))
            ) : (
              <EmptyState text="Nenhuma busca registrada ainda." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <Zap className="size-5 text-[#69F0AE]" />
              Consumo IA
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            <Metric label="Créditos disponíveis" value={String(credits.balance)} />
            <Metric label="Créditos consumidos" value={String(credits.usedThisMonth)} />
            <Metric label="Estimativa restante" value={`${remainingEstimate} ações`} />
            <Metric label="Pacote atual" value={currentPackage} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem] border-white/[0.08] bg-white/[0.03] py-0">
        <CardHeader className="px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-xl text-white">
            <Lightbulb className="size-5 text-[#69F0AE]" />
            Ações recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-6 pt-0">
          {recommendedActions.length > 0 ? (
            recommendedActions.map((action) => (
              <div key={action} className="rounded-[1rem] border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/65">
                {action}
              </div>
            ))
          ) : (
            <EmptyState text="Sua operação está pronta. Continue acompanhando leads, catálogo e créditos IA." />
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function Metric({ label, value, tone = "muted" }: { label: string; value: string; tone?: "green" | "muted" }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={`mt-2 text-base font-semibold ${tone === "green" ? "text-[#69F0AE]" : "text-white"}`}>{value}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[#00C853]/16 bg-[#00C853]/[0.06] p-4 text-sm leading-6 text-[#69F0AE]">
      <CheckCircle2 className="mb-3 size-5" />
      {text}
    </div>
  )
}
