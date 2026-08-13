import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/marketplace/pages/page-shell'

export const metadata: Metadata = {
  title: 'Privacidade | EME Imóveis',
  description: 'Como os dados são tratados na experiência demonstrativa do EME Imóveis.',
}

export default function PrivacyPage() {
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-eme-50 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-primary">Institucional</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">Privacidade</h1>
        <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
          Esta é uma experiência demonstrativa. Os formulários apresentados simulam o encaminhamento de interesse e não enviam dados para uma base externa.
        </p>
        <div className="mt-10 rounded-3xl border border-border bg-surface p-6 md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Transparência desde o primeiro contato</h2>
          <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
            <p>Em uma integração real, dados como nome, telefone e preferências serão utilizados somente para responder à solicitação do cliente e conectar o atendimento ao corretor responsável.</p>
            <p>O tratamento deverá seguir a legislação aplicável, com controles de acesso, retenção limitada e canais para consulta, correção ou exclusão das informações.</p>
            <p>Dúvidas podem ser encaminhadas para contato@emeimoveis.com.br.</p>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
