"use client"

import { DatabaseZap, ShieldCheck } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AdminPortal() {
  return (
    <AdminPageShell title="Admin EME" subtitle="Gestão da plataforma">
      <section className="grid gap-5 xl:grid-cols-2">
        <EmptyOperationalCard
          icon={DatabaseZap}
          title="Sem dados operacionais"
          description="O banco está limpo para testes reais. Novos imóveis, assinaturas, alertas e movimentos operacionais aparecerão aqui conforme forem criados de verdade."
        />
        <EmptyOperationalCard
          icon={ShieldCheck}
          title="Ambiente pronto para validação"
          description="A área administrativa não está mais usando números, gráficos ou listas simuladas como fallback."
        />
      </section>
    </AdminPageShell>
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
