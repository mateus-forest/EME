"use client"

import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Bot,
  Camera,
  Home,
  Megaphone,
  Sparkles,
  Users,
  Video,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StudioAction = {
  title: string
  description: string
  icon: typeof Home
  status: string
  href?: string
  cta?: string
}

const studioActions: StudioAction[] = [
  {
    title: "Biblioteca",
    description: "Consulte todo o histórico de campanhas, imagens, vídeos e copys gerados pelo Studio IA.",
    icon: BookOpen,
    href: "/corretor/studio-ia/biblioteca",
    cta: "Abrir biblioteca",
    status: "Disponivel",
  },
  {
    title: "Vender este imovel",
    description: "Organize uma ação focada em conversão para apresentar o imóvel certo no momento certo.",
    icon: Home,
    href: "/corretor/studio-ia/vender-este-imovel",
    cta: "Abrir fluxo",
    status: "Disponivel",
  },
  {
    title: "Criar campanha para Instagram",
    description: "Monte uma campanha visual para publicar o imovel com narrativa pronta para redes sociais.",
    icon: Megaphone,
    href: "/corretor/studio-ia/criar-campanha-instagram",
    cta: "Abrir fluxo",
    status: "Disponivel",
  },
  {
    title: "Criar video do imovel",
    description: "Estruture a producao de um video comercial com foco em captacao de atencao e visitas.",
    icon: Video,
    href: "/corretor/studio-ia/criar-video-do-imovel",
    cta: "Abrir fluxo",
    status: "Disponivel",
  },
  {
    title: "Transformar obra em imovel pronto",
    description: "Use uma imagem real da obra e gere uma versao pronta para venda com aprovacao e novas versoes.",
    icon: Sparkles,
    href: "/corretor/studio-ia/transformar-obra-em-imovel-pronto",
    cta: "Abrir fluxo",
    status: "Disponivel",
  },
  {
    title: "Atrair compradores",
    description: "Planeje a mensagem e os ganchos comerciais para aumentar interesse qualificado no imovel.",
    icon: Users,
    href: "/corretor/studio-ia/atrair-compradores",
    cta: "Abrir fluxo",
    status: "Disponivel",
  },
  {
    title: "Captar proprietarios",
    description: "Estruture abordagens de captacao para ampliar a carteira com foco no perfil certo.",
    icon: Camera,
    href: "/corretor/studio-ia/captar-proprietarios",
    cta: "Abrir fluxo",
    status: "Disponivel",
  },
]

export function BrokerStudioIaHomePage() {
  return (
    <BrokerPageShell title="Studio IA">
      <div className="min-w-0 grid gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Bot className="size-3.5" />
                Studio IA
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Central de criacao com IA</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Crie campanhas, imagens, vídeos, anúncios e conteúdos para divulgar seus imóveis com inteligência artificial.
              </p>
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {studioActions.map((action) => {
            const Icon = action.icon
            const isAvailable = Boolean(action.href)

            return (
              <Card key={action.title} className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
                <CardHeader className="px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
                      <Icon className="size-5" />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${isAvailable ? "bg-[#eef9f1] text-[#009b3a]" : "bg-[#f2f4f7] text-[#667085]"}`}>
                      {action.status}
                    </span>
                  </div>
                  <CardTitle className="pt-4 text-xl text-[#050505]">{action.title}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 pt-0">
                  <p className="text-sm leading-6 text-[#6B7280]">{action.description}</p>
                  {action.href ? (
                    <Button asChild className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]">
                      <Link href={action.href}>
                        {action.cta ?? "Abrir"}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled
                      className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#98A2B3] disabled:opacity-100"
                    >
                      Em breve
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </section>
      </div>
    </BrokerPageShell>
  )
}
