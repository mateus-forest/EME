"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bot, CheckCircle2, MessageCircle, Search, Sparkles, UsersRound, Zap } from "lucide-react"

import type { BrokerProperty } from "@/components/use-broker-properties"
import type { BrokerSubscription } from "@/components/use-broker-subscription"
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

export function BrokerIntelligenceDashboard({ properties, subscription }: BrokerIntelligenceDashboardProps) {
  const [credits, setCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [assistantEnabled, setAssistantEnabled] = useState(true)

  useEffect(() => {
    let ignore = false

    fetch("/api/ai/broker-assistant", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { credits?: AssistantCredits } | null
        if (!ignore && response.ok && data?.credits) {
          setCredits(data.credits)
        }
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  const totalLeads = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.leads || 0), 0),
    [properties],
  )
  const newLeads = totalLeads > 0 ? Math.max(1, Math.ceil(totalLeads * 0.35)) : 0
  const pendingLeads = totalLeads > 0 ? Math.max(1, Math.ceil(totalLeads * 0.2)) : 0
  const convertedLeads = totalLeads > 0 ? Math.max(0, Math.floor(totalLeads * 0.12)) : 0
  const remainingEstimate = Math.max(0, credits.balance)
  const actionsCount = credits.usedThisMonth
  const currentPackage = subscription.isUpgraded ? "Corretor M Pro" : "Corretor M inicial"

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
                <CardTitle className="mt-4 text-2xl text-white">Corretor M</CardTitle>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/58">
                  Central inteligente para criar anuncios, analisar leads, melhorar catalogo e preparar atendimentos.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAssistantEnabled((current) => !current)}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 text-white/80 hover:bg-white/[0.08] hover:text-white"
              >
                {assistantEnabled ? "Desativar" : "Ativar"} Corretor M
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Status" value={assistantEnabled ? "Ativo" : "Pausado"} tone={assistantEnabled ? "green" : "muted"} />
            <Metric label="Créditos IA" value={String(credits.balance)} />
            <Metric label="Uso no mês" value={String(credits.usedThisMonth)} />
            <Metric label="Ações IA" value={actionsCount > 0 ? String(actionsCount) : "Aguardando uso"} />
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4 sm:col-span-2 xl:col-span-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Última interação</p>
              <p className="mt-2 text-sm text-white/68">
                {actionsCount > 0 ? "Última ação registrada neste mês." : "O Corretor M ainda não realizou ações."}
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
                <CardTitle className="text-xl text-white">WhatsApp conectado</CardTitle>
                <p className="mt-1 text-sm text-[#25D366]">Status ativo</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-2xl font-semibold text-white">(54) 99990-2688</p>
            <p className="mt-3 text-sm leading-6 text-white/58">
              O Corretor M continuará seus atendimentos pelo WhatsApp conectado.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-5 h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/78 hover:bg-white/[0.08] hover:text-white"
            >
              Gerenciar
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <UsersRound className="size-5 text-[#69F0AE]" />
              Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {totalLeads > 0 ? (
              <>
                <Metric label="Recebidos" value={String(totalLeads)} />
                <Metric label="Novos" value={String(newLeads)} />
                <Metric label="Aguardando resposta" value={String(pendingLeads)} />
                <Metric label="Convertidos" value={String(convertedLeads)} />
              </>
            ) : (
              <EmptyState text="Nenhum lead recebido ainda." />
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
            {["Apartamento até 700 mil", "Casa com piscina", "Condomínio fechado"].map((query) => (
              <div key={query} className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-medium text-white">{query}</p>
                <p className="mt-1 text-xs text-white/45">Busca inteligente preparada para matching no catálogo.</p>
              </div>
            ))}
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
