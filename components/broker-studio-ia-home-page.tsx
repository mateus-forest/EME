"use client"

import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Clapperboard,
  Home,
  ImagePlus,
  Megaphone,
  Sparkles,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StudioAction = {
  title: string
  description: string
  icon: typeof Home
  href: string
}

const studioActions: StudioAction[] = [
  {
    title: "Criar campanha",
    description: "Crie conteúdo completo para divulgar seus imóveis nas redes sociais.",
    icon: Megaphone,
    href: "/corretor/studio-ia/criar-campanha-instagram",
  },
  {
    title: "Preparar imóvel",
    description: "Organize e prepare as fotografias do imóvel para uma apresentação mais atraente.",
    icon: ImagePlus,
    href: "/corretor/studio-ia/preparar-imovel",
  },
  {
    title: "Visualizar projeto",
    description: "Área reservada para representações arquitetônicas em validação.",
    icon: Building2,
    href: "/corretor/studio-ia/visualizar-projeto",
  },
  {
    title: "Criar vídeo",
    description: "Transforme as melhores imagens do imóvel em uma apresentação em vídeo.",
    icon: Clapperboard,
    href: "/corretor/studio-ia/criar-video-do-imovel",
  },
  {
    title: "Criar anúncio",
    description: "Crie materiais e mensagens focados em promover um imóvel e gerar oportunidades.",
    icon: Sparkles,
    href: "/corretor/studio-ia/atrair-compradores",
  },
  {
    title: "Captar imóveis",
    description: "Crie campanhas para encontrar proprietários e ampliar sua carteira.",
    icon: Home,
    href: "/corretor/studio-ia/captar-proprietarios",
  },
]

export function BrokerStudioIaHomePage() {
  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#009b3a]">Studio IA</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505] sm:text-4xl">Estúdio</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A] sm:text-base">
                Crie o material comercial dos seus imóveis.
              </p>
            </div>

            <Link
              href="/corretor/studio-ia/biblioteca"
              className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl px-1 py-2 text-sm font-semibold text-[#4B5563] transition-colors hover:text-[#009b3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009b3a]/25"
            >
              Biblioteca
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studioActions.map((action) => {
            const Icon = action.icon

            return (
              <Link key={action.title} href={action.href} className="group min-w-0 rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009b3a]/25">
                <Card className="h-full min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[#009b3a]/16 group-hover:shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
                  <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/14 bg-[#eef9f1] text-[#009b3a]">
                        <Icon className="size-5" />
                      </div>
                      <ArrowRight className="mt-1 size-4 text-[#B0B7C0] transition group-hover:translate-x-0.5 group-hover:text-[#009b3a]" />
                    </div>
                    <CardTitle className="pt-5 text-xl text-[#050505]">{action.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-6 pt-0 sm:px-6">
                    <p className="text-sm leading-6 text-[#6B7280]">{action.description}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </section>
      </div>
    </BrokerPageShell>
  )
}
