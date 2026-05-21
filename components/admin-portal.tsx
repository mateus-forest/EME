"use client"

import { useEffect, useState } from "react"
import { BarChart3, Bot, CreditCard, DatabaseZap, Home, MessageCircle, ShieldCheck, Sparkles, UserRound } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import { formatCurrencyBRL } from "@/components/use-admin-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type AdminOverview = {
  brokers: number
  properties: number
  leads: number
  subscriptions: {
    total: number
    active: number
    evaluation: number
    pending: number
    canceled: number
  }
  ai: {
    creditsAvailable: number
    creditsUsedThisMonth: number
  }
  revenue: {
    predicted: number
  }
  corretorEme: {
    active: number
    preparing: number
  }
  assessorEme: {
    status: string
    hasOfficialNumber: boolean
  }
}

const emptyOverview: AdminOverview = {
  brokers: 0,
  properties: 0,
  leads: 0,
  subscriptions: {
    total: 0,
    active: 0,
    evaluation: 0,
    pending: 0,
    canceled: 0,
  },
  ai: {
    creditsAvailable: 0,
    creditsUsedThisMonth: 0,
  },
  revenue: {
    predicted: 0,
  },
  corretorEme: {
    active: 0,
    preparing: 0,
  },
  assessorEme: {
    status: "Canal em preparação",
    hasOfficialNumber: false,
  },
}

export function AdminPortal() {
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview)

  useEffect(() => {
    let isMounted = true

    fetch("/api/admin/overview", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { overview?: AdminOverview } | null
        if (response.ok && data?.overview && isMounted) {
          setOverview(data.overview)
        }
      })
      .catch(() => null)

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <AdminPageShell title="Admin EME" subtitle="Gestão da plataforma">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Corretores cadastrados" value={String(overview.brokers)} icon={UserRound} />
        <MetricCard label="Imóveis cadastrados" value={String(overview.properties)} icon={Home} />
        <MetricCard label="Leads registrados" value={String(overview.leads)} icon={MessageCircle} />
        <MetricCard label="Receita prevista" value={formatCurrencyBRL(overview.revenue.predicted)} icon={BarChart3} />
        <MetricCard label="Assinaturas" value={`${overview.subscriptions.active} ativas / ${overview.subscriptions.evaluation} avaliação`} icon={CreditCard} />
        <MetricCard label="Consumo IA" value={`${overview.ai.creditsUsedThisMonth} usados`} icon={Sparkles} />
        <MetricCard label="Corretor EME" value={`${overview.corretorEme.active} ativas / ${overview.corretorEme.preparing} preparação`} icon={DatabaseZap} />
        <MetricCard label="Assessor EME" value={overview.assessorEme.status} icon={Bot} />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <EmptyOperationalCard
          icon={ShieldCheck}
          title="Operação focada em corretores"
          description="O dashboard consolida corretores individuais, imóveis, leads, consumo de IA, assinaturas e canais EME sem fluxo de equipes no MVP."
        />
        <EmptyOperationalCard
          icon={CreditCard}
          title="Assinaturas e avaliação"
          description={`${overview.subscriptions.total} registros no total: ${overview.subscriptions.active} ativos, ${overview.subscriptions.evaluation} em avaliação, ${overview.subscriptions.pending} pendentes e ${overview.subscriptions.canceled} cancelados.`}
        />
      </section>
    </AdminPageShell>
  )
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof DatabaseZap }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyOperationalCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof DatabaseZap
  title: string
  description: string
}) {
  return (
    <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardHeader className="px-6 py-5">
        <CardTitle className="flex items-center gap-3 text-xl text-white">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
            <Icon className="size-5" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <p className="text-sm leading-7 text-white/58">{description}</p>
      </CardContent>
    </Card>
  )
}
