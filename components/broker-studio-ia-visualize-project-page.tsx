"use client"

import Link from "next/link"
import { ArrowLeft, Building2, ShieldCheck } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function BrokerStudioIaVisualizeProjectPage() {
  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#009b3a]">Representação de projetos</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">Visualizar projeto</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">
                Esta área será liberada somente para representações arquitetônicas compatíveis com a entrada e o resultado prometidos.
              </p>
            </div>
            <Button asChild variant="ghost" className="w-fit rounded-xl border border-black/[0.06] bg-white text-[#4B5563]">
              <Link href="/corretor/studio-ia"><ArrowLeft className="size-4" />Voltar ao Estúdio</Link>
            </Button>
          </div>
        </section>

        <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
          <CardContent className="p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#009b3a]/14 bg-[#eef9f1] text-[#009b3a]">
                <Building2 className="size-5" />
              </div>
              <div className="min-w-0 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight text-[#050505]">Capacidades em validação</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[11px] font-medium text-[#667085]">
                    <ShieldCheck className="size-3.5" />
                    Sem geração disponível
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">
                  Nenhuma operação de visualização arquitetônica está disponível neste momento.
                </p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                  As ferramentas atuais trabalham sobre fotografias de imóveis existentes. Elas não são usadas para criar construções futuras, concluir obras ou converter projetos em imagens realistas sem suporte específico para esses resultados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </BrokerPageShell>
  )
}
