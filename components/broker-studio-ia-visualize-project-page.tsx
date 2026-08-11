"use client"

import Link from "next/link"
import { ArrowLeft, Building2, Construction, Map } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const futureRepresentations = [
  { title: "Obra → finalizado", description: "Apresente o potencial de uma obra ainda em andamento.", icon: Construction },
  { title: "Terreno → construção", description: "Explore visualmente possibilidades para um terreno.", icon: Map },
  { title: "Projeto → ambiente", description: "Organize futuras representações de projetos imobiliários.", icon: Building2 },
] as const

export function BrokerStudioIaVisualizeProjectPage() {
  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#009b3a]">Representação de projetos</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">Visualizar projeto</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">
                Visualize o potencial de terrenos, obras e projetos antes de estarem prontos.
              </p>
            </div>
            <Button asChild variant="ghost" className="w-fit rounded-xl border border-black/[0.06] bg-white text-[#4B5563]">
              <Link href="/corretor/studio-ia"><ArrowLeft className="size-4" />Voltar ao Estúdio</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {futureRepresentations.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title} className="rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
                <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]"><Icon className="size-5" /></div>
                  <CardTitle className="pt-4 text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-6 pt-0 sm:px-6">
                  <p className="text-sm leading-6 text-[#6B7280]">{item.description}</p>
                  <span className="mt-4 inline-flex rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[11px] font-medium text-[#667085]">Em validação</span>
                </CardContent>
              </Card>
            )
          })}
        </section>
      </div>
    </BrokerPageShell>
  )
}
