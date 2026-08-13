'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'

export function BrokerContactForm({ brokerName }: { brokerName: string }) {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-[1.5rem] border border-border/70 bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-eme-50 text-primary">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-foreground">Mensagem preparada</h3>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {brokerName.split(' ')[0]} recebe seus dados e entra em contato pelo WhatsApp. (Demonstrativo — nada é enviado
          nesta etapa.)
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-6 text-sm font-medium text-primary hover:underline"
        >
          Enviar outra mensagem
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
      }}
      className="rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]"
    >
      <h3 className="text-lg font-semibold text-foreground">Falar com {brokerName.split(' ')[0]}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Conte o que procura e receba um retorno direto pelo WhatsApp.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Seu nome
          <input
            required
            type="text"
            placeholder="Seu nome"
            className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          WhatsApp
          <input
            required
            type="tel"
            inputMode="tel"
            placeholder="(54) 90000-0000"
            className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          O que você procura
          <textarea
            rows={3}
            placeholder="Ex.: casa com pátio em Vacaria, até R$ 750 mil"
            className="resize-none rounded-xl border border-border bg-background px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.01] active:scale-95"
      >
        <WhatsappGlyph className="h-4 w-4" />
        Continuar pelo WhatsApp
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Seu contato é enviado diretamente ao profissional responsável.
      </p>
    </form>
  )
}
