'use client'

import { Camera, Film, Home, Megaphone, Sparkles, Users } from 'lucide-react'
import { Reveal, Stagger, StaggerItem } from './reveal'

const FLOWS = [
  { icon: Home, title: 'Vender imóvel', desc: 'Do anúncio ao fechamento, com todo o material de venda pronto.' },
  { icon: Megaphone, title: 'Criar campanha', desc: 'Uma campanha visual pronta para as redes, com narrativa incluída.' },
  { icon: Film, title: 'Criar vídeo', desc: 'Um comercial estruturado para captar atenção e visitas.' },
  { icon: Sparkles, title: 'Transformar obra', desc: 'Da imagem da obra a uma versão pronta para vender.' },
  { icon: Camera, title: 'Captar proprietários', desc: 'Abordagens de captação para ampliar sua carteira.' },
  { icon: Users, title: 'Atrair compradores', desc: 'Mensagens e ganchos que geram interesse qualificado.' },
]

export function StudioFlows() {
  return (
    <section id="studio" className="px-6 py-28 sm:px-10 sm:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="mb-4 text-sm font-medium tracking-tight text-brand">Studio IA</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="max-w-3xl text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            Um estúdio inteiro num clique.
          </h2>
        </Reveal>

        <Stagger className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FLOWS.map((f) => {
            const Icon = f.icon
            return (
              <StaggerItem key={f.title}>
                <div className="group h-full rounded-3xl border border-border/70 bg-card p-7 transition-all duration-500 hover:-translate-y-1 hover:border-brand/30 hover:shadow-[0_30px_80px_-40px_rgba(20,120,60,0.35)]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand transition-colors duration-500 group-hover:bg-brand group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <h3 className="mt-6 text-xl font-medium tracking-tight">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}
