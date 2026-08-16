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
import { BrokerPageIntro, BrokerSurface } from "@/components/broker-portal-ui"

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
      <div className="grid min-w-0 gap-3.5">
        <BrokerPageIntro
          eyebrow="Studio IA"
          title="Estúdio"
          description="Crie o material comercial dos seus imóveis."
          actions={
            <Link
              href="/corretor/studio-ia/biblioteca"
              className="inline-flex h-9 w-fit shrink-0 items-center gap-1.5 rounded-lg border border-black/[0.07] bg-white px-3 text-xs font-semibold text-[#344054] transition-colors hover:bg-[#f7f8f5] hover:text-[#008633] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009b3a]/25"
            >
              Biblioteca
              <ArrowUpRight className="size-4" />
            </Link>
          }
        />

        <section className="grid min-w-0 gap-2.5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 min-[1380px]:grid-cols-6">
          {studioActions.map((action) => {
            const Icon = action.icon

            return (
              <Link key={action.title} href={action.href} className="group min-w-0 rounded-[var(--broker-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009b3a]/25">
                <BrokerSurface as="article" padding="compact" className="flex h-full min-h-[8.25rem] flex-col transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[#009b3a]/16 group-hover:shadow-[0_16px_38px_rgba(15,23,42,0.07)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-8 items-center justify-center rounded-[0.7rem] border border-[#009b3a]/12 bg-[#eef9f1] text-[#009b3a]">
                        <Icon className="size-4" />
                      </div>
                      <ArrowRight className="mt-1 size-4 text-[#B0B7C0] transition group-hover:translate-x-0.5 group-hover:text-[#009b3a]" />
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold leading-tight text-[#111827]">{action.title}</h3>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-[1.15rem] text-[#667085]">{action.description}</p>
                </BrokerSurface>
              </Link>
            )
          })}
        </section>
      </div>
    </BrokerPageShell>
  )
}
