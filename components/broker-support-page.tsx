"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Lightbulb, Mail, MessageCircle, Search } from "lucide-react"

import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const faqItems = [
  {
    question: "Como criar um anúncio?",
    answer: "Acesse Novo imóvel, envie as fotos e clique em gerar anúncio com IA.",
  },
  {
    question: "Como editar um imóvel?",
    answer: "Na página Meus imóveis, clique em Editar e ajuste as informações sem sair da tela.",
  },
  {
    question: "Como funciona o catálogo?",
    answer: "Seu catálogo reúne seus imóveis publicados em uma página pronta para compartilhar com clientes.",
  },
  {
    question: "Como compartilhar meu link?",
    answer: "Na área de Catálogo, copie o link público ou envie direto no WhatsApp.",
  },
  {
    question: "Como melhorar meus resultados?",
    answer: "Use boas fotos, descrição clara e acompanhe os insights em Analytics para repetir o que funciona.",
  },
]

const quickTips = [
  "Use fotos boas para ter mais cliques",
  "Imóveis com descrição convertem mais",
  "Compartilhe seu catálogo no WhatsApp",
]

export function BrokerSupportPage() {
  const [search, setSearch] = useState("")
  const supportWhatsAppUrl = createWhatsAppUrl(
    "(11) 98888-0000",
    "Olá, preciso de ajuda com o portal da EME",
  )
  const normalizedSearch = search.trim().toLowerCase()

  const filteredFaqItems = useMemo(
    () =>
      faqItems.filter((item) =>
        normalizedSearch
          ? item.question.toLowerCase().includes(normalizedSearch) ||
            item.answer.toLowerCase().includes(normalizedSearch)
          : true,
      ),
    [normalizedSearch],
  )

  const filteredQuickTips = useMemo(
    () =>
      quickTips.filter((tip) => (normalizedSearch ? tip.toLowerCase().includes(normalizedSearch) : true)),
    [normalizedSearch],
  )

  return (
    <BrokerPageShell title="Suporte">
      <div className="grid gap-6">
        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] px-6 py-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Suporte</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Precisa de ajuda? Resolva rápido ou fale com a gente
          </h2>

          <div className="mt-5 max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ajuda..."
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>
          </div>
        </section>

        {normalizedSearch && (
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            Filtrando resultados...
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Principais dúvidas</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4 pt-0">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqItems.map((item) => (
                  <AccordionItem key={item.question} value={item.question} className="border-white/[0.08]">
                    <AccordionTrigger className="py-4 text-base text-white hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-7 text-white/60">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {filteredFaqItems.length === 0 && (
                <div className="py-4 text-sm text-white/55">Nenhuma ajuda encontrada.</div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Falar com suporte</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                <p className="text-sm text-white/55">Respondemos o mais rápido possível.</p>
                <Button
                  asChild
                  className="h-10 rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  <a href={supportWhatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  <a href="mailto:suporte@eme.com">
                    <Mail className="size-4" />
                    suporte@eme.com
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-white/50">Status do sistema</p>
                  <p className="mt-1 text-base font-semibold text-white">Tudo funcionando normalmente</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {filteredQuickTips.map((tip) => (
            <Card
              key={tip}
              className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
            >
              <CardContent className="p-5">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                  <Lightbulb className="size-4.5" />
                </div>
                <p className="mt-4 text-sm leading-7 text-white/70">{tip}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </BrokerPageShell>
  )
}
