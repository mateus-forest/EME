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
    answer: "Na página Imóveis, clique em Editar e ajuste as informações sem sair da tela.",
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
    answer: "Use boas fotos, descrição clara e acompanhe os insights em Desempenho para repetir o que funciona.",
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
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#7B8491]">Suporte</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">
            Precisa de ajuda? Resolva rápido ou fale com a gente
          </h2>

          <div className="mt-5 max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#8B95A1]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ajuda..."
                className="h-11 w-full rounded-xl border border-black/[0.06] bg-white/80 pl-11 pr-4 text-sm text-[#050505] outline-none placeholder:text-[#8B95A1]"
              />
            </div>
          </div>
        </section>

        {normalizedSearch && (
          <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
            Filtrando resultados...
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Principais dúvidas</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4 pt-0">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqItems.map((item) => (
                  <AccordionItem key={item.question} value={item.question} className="border-black/[0.06]">
                    <AccordionTrigger className="py-4 text-base text-[#050505] hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-7 text-[#5F6B7A]">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {filteredFaqItems.length === 0 && (
                <div className="py-4 text-sm text-[#6B7280]">Nenhuma ajuda encontrada.</div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-[#050505]">Falar com suporte</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                <p className="text-sm text-[#6B7280]">Respondemos o mais rápido possível.</p>
                <Button
                  asChild
                  className="h-10 rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                >
                  <a href={supportWhatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                >
                  <a href="mailto:suporte@eme.com">
                    <Mail className="size-4" />
                    suporte@eme.com
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Status do sistema</p>
                  <p className="mt-1 text-base font-semibold text-[#050505]">Tudo funcionando normalmente</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {filteredQuickTips.map((tip) => (
            <Card
              key={tip}
              className="rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
            >
              <CardContent className="p-5">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                  <Lightbulb className="size-4.5" />
                </div>
                <p className="mt-4 text-sm leading-7 text-[#5F6B7A]">{tip}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </BrokerPageShell>
  )
}
