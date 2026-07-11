"use client"

import Link from "next/link"
import { Bot, FileText, MessageCircle, Sparkles, Wand2 } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const studioTracks = [
  {
    title: "Anuncios",
    description: "Base preparada para organizar criacao, revisao e variacoes comerciais de conteudo.",
    icon: Wand2,
  },
  {
    title: "Materiais",
    description: "Espaco reservado para centralizar textos, roteiros e pecas por imovel ou campanha.",
    icon: FileText,
  },
  {
    title: "Assistencia IA",
    description: "A estrutura do Studio fica separada do Assessor EME, sem mudar a logica existente nesta fase.",
    icon: Bot,
  },
] as const

export function BrokerStudioIaPage() {
  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Sparkles className="size-3.5" />
                Nova frente comercial
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Studio IA em preparacao</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">
                Esta e a base visual do novo modulo. Nesta fase, a arquitetura fica pronta sem mover funcionalidades nem alterar integracoes do portal.
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

        <section className="grid gap-4 lg:grid-cols-3">
          {studioTracks.map((track) => (
            <Card key={track.title} className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
              <CardHeader className="px-5 py-5">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
                  <track.icon className="size-5" />
                </div>
                <CardTitle className="pt-4 text-lg text-[#050505]">{track.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <p className="text-sm leading-6 text-[#6B7280]">{track.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-5">
          <p className="text-sm leading-6 text-[#5F6B7A]">
            Nenhuma funcionalidade nova foi ativada aqui ainda. O objetivo desta etapa e consolidar a navegacao definitiva antes da expansao do modulo.
          </p>
        </section>
      </div>
    </BrokerPageShell>
  )
}
