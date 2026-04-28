"use client"

import { useMemo, useState } from "react"
import { ChevronDown, LifeBuoy, Mail, MessageCircle, Search, Sparkles, Wrench } from "lucide-react"

import { AgencyPageShell } from "@/components/agency-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const faqs = [
  {
    question: "Como convidar um corretor?",
    answer:
      "Acesse a página de Corretores, clique em 'Convidar corretor' e envie os dados básicos. O convite fica como pendente até a ativação.",
  },
  {
    question: "Como funciona o catálogo da imobiliária?",
    answer:
      "O catálogo institucional reúne os imóveis da operação em um link compartilhável com visual público limpo e gestão interna no portal.",
  },
  {
    question: "Como acompanhar o desempenho da equipe?",
    answer:
      "Use a página de Analytics para ver visualizações, leads, cliques no WhatsApp e desempenho por corretor e por imóvel.",
  },
  {
    question: "Como funcionam os corretores ativos no plano?",
    answer:
      "Cada corretor ativo compõe o custo mensal da operação. A página de Plano mostra o total com transparência.",
  },
  {
    question: "Como compartilhar o catálogo institucional?",
    answer:
      "Na página de Catálogo, copie o link institucional e compartilhe com clientes ou equipe sempre que precisar.",
  },
]

const quickTips = [
  "Corretores ativos impactam no valor mensal do plano.",
  "Catálogos institucionais atualizam em tempo real.",
  "Acompanhe leads e visualizações no Analytics.",
]

export function AgencySupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [search, setSearch] = useState("")
  const normalizedSearch = search.trim().toLowerCase()

  const filteredFaqs = useMemo(
    () =>
      faqs.filter((faq) =>
        normalizedSearch
          ? faq.question.toLowerCase().includes(normalizedSearch) ||
            faq.answer.toLowerCase().includes(normalizedSearch)
          : true,
      ),
    [normalizedSearch],
  )

  const filteredTips = useMemo(
    () =>
      quickTips.filter((tip) => (normalizedSearch ? tip.toLowerCase().includes(normalizedSearch) : true)),
    [normalizedSearch],
  )

  return (
    <AgencyPageShell
      title="Suporte"
      subtitle="Resolva dúvidas rapidamente ou fale com a nossa equipe"
    >
      <div className="grid gap-6">
        <section className="rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/35" />
            <InputSearch value={search} onChange={setSearch} />
          </div>
        </section>

        {normalizedSearch && (
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            Filtrando resultados...
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Perguntas frequentes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 pt-0">
                {filteredFaqs.map((faq, index) => {
                  const isOpen = openIndex === index

                  return (
                    <button
                      key={faq.question}
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{faq.question}</p>
                        <ChevronDown
                          className={`size-4 shrink-0 text-white/45 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      {isOpen && <p className="mt-3 text-sm leading-6 text-white/65">{faq.answer}</p>}
                    </button>
                  )
                })}
                {filteredFaqs.length === 0 && (
                  <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                    Nenhuma ajuda encontrada.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Dicas rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 pt-0 md:grid-cols-3">
                {filteredTips.map((tip) => (
                  <div key={tip} className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-white/50">
                      <Sparkles className="size-4 text-[#69F0AE]" />
                      <span className="text-sm">Dica</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/70">{tip}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Falar com suporte</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                <p className="text-sm leading-6 text-white/60">Respondemos o mais rápido possível.</p>
                <Button className="h-10 rounded-xl bg-[#25D366] text-sm font-semibold text-white hover:bg-[#2fe06f]">
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  <Mail className="size-4" />
                  suporte@eme.com
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Status do sistema</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 p-4">
                  <div className="flex items-center gap-2 text-[#69F0AE]">
                    <Wrench className="size-4" />
                    <span className="text-sm font-medium">Tudo funcionando normalmente</span>
                  </div>
                  <p className="mt-2 text-sm text-white/65">
                    Nenhuma instabilidade detectada no portal da imobiliária.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                  <LifeBuoy className="size-4" />
                </div>
                <p className="text-sm text-white/65">
                  Se precisar de ajuda, você consegue resolver rápido por aqui.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AgencyPageShell>
  )
}

function InputSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Buscar ajuda..."
      className="h-11 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
    />
  )
}
