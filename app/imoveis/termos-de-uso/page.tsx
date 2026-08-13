import type { Metadata } from 'next'
import { FileCheck2 } from 'lucide-react'
import { PageShell } from '@/components/marketplace/pages/page-shell'

export const metadata: Metadata = {
  title: 'Termos de uso | EME Imóveis',
  description: 'Termos da experiência pública do EME Imóveis.',
}

export default function TermsPage() {
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-eme-50 text-primary">
          <FileCheck2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-primary">Institucional</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">Termos de uso</h1>
        <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
          O EME Imóveis apresenta anúncios publicados pelos profissionais responsáveis. Informações, valores e disponibilidade devem ser confirmados antes de qualquer negociação.
        </p>
        <div className="mt-10 rounded-3xl border border-border bg-surface p-6 md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Uso do Marketplace</h2>
          <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
            <p>Os conteúdos não constituem oferta, proposta comercial ou garantia de disponibilidade. Antes de qualquer decisão, confirme as condições diretamente com o profissional responsável.</p>
            <p>Fotos, descrições e dados do imóvel são fornecidos a partir do cadastro mantido pelo corretor responsável.</p>
            <p>Ao enviar um interesse, você autoriza o encaminhamento dos dados informados ao profissional responsável pelo atendimento.</p>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
