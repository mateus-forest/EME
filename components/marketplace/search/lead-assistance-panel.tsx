'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, MessageCircle, X } from 'lucide-react'
import { OrganicLines } from '@/components/marketplace/organic-lines'

export function LeadAssistancePanel({
  open,
  onOpenChange,
  searchSummary,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  searchSummary: string
}) {
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  // Ao fechar, reinicia o estado de confirmação para o próximo uso.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setSubmitted(false), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  return (
    <>
      {/* Painel de chamada no fim da página */}
      <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-surface p-8 shadow-[var(--shadow-soft)] md:p-12">
          <OrganicLines className="opacity-70" count={5} />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Ainda não encontrou o imóvel certo?
              </h2>
              <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                Envie o que procura e conectamos você a um profissional da região.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Quero ajuda para encontrar
            </button>
          </div>
        </div>
      </section>

      {/* Modal do formulário */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pedir ajuda para encontrar"
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-[var(--shadow-float)] sm:max-w-lg sm:rounded-3xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
          >
            <div className="flex items-center justify-between border-b border-border/70 px-6 py-5">
              <h2 className="text-lg font-semibold text-foreground">Ajuda para encontrar</h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-eme-50 text-primary">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-foreground">Recebemos o seu pedido</h3>
                <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                  Um profissional da região vai entrar em contato com base no que você procura. (Demonstrativo)
                </p>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setSubmitted(true)
                }}
                className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6"
              >
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  Nome
                  <input
                    required
                    type="text"
                    placeholder="Seu nome"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  WhatsApp
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    placeholder="(54) 90000-0000"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  Resumo da busca
                  <textarea
                    defaultValue={searchSummary}
                    rows={2}
                    className="resize-none rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Prazo
                    <select className="rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10">
                      <option value="">Opcional</option>
                      <option>Sem pressa</option>
                      <option>Até 30 dias</option>
                      <option>Até 90 dias</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Financiamento
                    <select className="rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10">
                      <option value="">Opcional</option>
                      <option>Vou financiar</option>
                      <option>À vista</option>
                      <option>Ainda não sei</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Contato
                    <select className="rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10">
                      <option value="">Opcional</option>
                      <option>Manhã</option>
                      <option>Tarde</option>
                      <option>Noite</option>
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Enviar pedido
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Demonstrativo — nenhum dado é enviado nesta etapa.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
