"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Lightbulb, Mail, MessageCircle, Search } from "lucide-react"

import { EME_SUPPORT_WHATSAPP_NUMBER } from "@/lib/support"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerPageIntro, BrokerSurface, BrokerToolbar } from "@/components/broker-portal-ui"
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
    EME_SUPPORT_WHATSAPP_NUMBER,
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
      <div className="grid gap-4">
        <BrokerPageIntro
          eyebrow="Central de ajuda"
          title="Precisa de ajuda?"
          description="Encontre respostas rápidas ou fale com a equipe EME."
        />

        <BrokerToolbar
          start={
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#8B95A1]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ajuda..."
                className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-11 pr-4 text-sm text-[#050505] outline-none placeholder:text-[#8B95A1] focus:border-[#009b3a]/25 focus:ring-2 focus:ring-[#009b3a]/10"
              />
            </div>
          }
        />

        {normalizedSearch && (
          <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
            Filtrando resultados...
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="rounded-[var(--broker-radius-lg)] border-black/[0.06] bg-white py-0 shadow-[var(--broker-shadow-xs)]">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-xl text-[#050505]">Principais dúvidas</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-3 pt-0">
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

          <div className="grid content-start gap-4">
            <Card className="rounded-[var(--broker-radius-lg)] border-black/[0.06] bg-white py-0 shadow-[var(--broker-shadow-xs)]">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-xl text-[#050505]">Falar com suporte</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 pt-0">
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

            <BrokerSurface padding="compact">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-[#6B7280]">Status do sistema</p>
                  <p className="mt-1 text-base font-semibold text-[#050505]">Tudo funcionando normalmente</p>
                </div>
              </div>
            </BrokerSurface>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {filteredQuickTips.map((tip) => (
            <Card
              key={tip}
              className="rounded-[var(--broker-radius-lg)] border-black/[0.06] bg-white py-0 shadow-[var(--broker-shadow-xs)]"
            >
              <CardContent className="p-4">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                  <Lightbulb className="size-4.5" />
                </div>
                <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">{tip}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </BrokerPageShell>
  )
}
