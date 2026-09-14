"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { BrokerNewPropertyPage } from "@/components/broker-new-property-page"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { captureApi } from "@/components/broker-captacao-page"
import type { Capture, Listing } from "@/lib/captacao/contract"
export type CaptureInventoryContext = {
  id: string
  listing: Listing
  ownerName: string
  reviewed: true
  duplicatesReviewed: true
}
type Review = {
  capture: Capture
  possibleDuplicates: {
    id: string
    title: string
    city: string
    price: number
  }[]
}
export function BrokerCaptacaoInventory({ id }: { id: string }) {
  const [data, setData] = useState<Review | null>(null),
    [leads, setLeads] = useState<{ id: string; name: string; phone: string }[]>(
      [],
    ),
    [lead, setLead] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [context, setContext] = useState<CaptureInventoryContext | null>(null)
  async function loadLeads() {
    const r = await captureApi<{ leads: typeof leads }>("/api/brokers/leads")
    setLeads(r.leads)
  }
  useEffect(() => {
    let live = true
    Promise.all([
      captureApi<Review>(`/api/brokers/captacao/${id}`),
      captureApi<{ leads: typeof leads }>("/api/brokers/leads"),
    ])
      .then(([r, c]) => {
        if (live) {
          setData(r)
          setLeads(c.leads)
          setLead(r.capture.leadId ?? "")
        }
      })
      .catch((e) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [id])
  async function start() {
    if (!data || !reviewed || !lead) return
    setBusy(true)
    setError("")
    try {
      const r = await captureApi<{ capture: Capture }>(
        `/api/brokers/captacao/${id}`,
        { action: "lead", operationKey: crypto.randomUUID(), leadId: lead },
        "PATCH",
      )
      setContext({
        id,
        listing: r.capture.listing,
        ownerName:
          r.capture.advertiserKind === "owner"
            ? (leads.find((l) => l.id === lead)?.name ?? "")
            : "",
        reviewed: true,
        duplicatesReviewed: true,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (context) return <BrokerNewPropertyPage captureContext={context} />
  return (
    <BrokerPageShell
      title="Revisar inclusão na carteira"
      eyebrow="Carteira · Captação"
      subtitle="Confirme os dados e o contato antes de abrir o cadastro atual de imóvel."
    >
      <Card className="max-w-3xl shadow-none">
        <CardContent className="grid gap-4 pt-5">
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {!data && !error && <p role="status">Carregando revisão…</p>}
          {data && (
            <>
              <h2 className="text-lg font-semibold">
                {data.capture.listing.title}
              </h2>
              {data.capture.propertyId ? (
                <Link
                  className="text-green-800 underline"
                  href={`/corretor/imoveis/${data.capture.propertyId}`}
                >
                  Este imóvel já está na carteira. Abrir cadastro existente.
                </Link>
              ) : data.capture.stage !== "CONFIRMED" ? (
                <p>
                  Confirme a captação no acompanhamento antes de adicionar à
                  carteira.
                </p>
              ) : (
                <>
                  <section className="rounded-xl border p-4">
                    <h3 className="text-sm font-semibold">
                      Verificação de possíveis duplicidades
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Comparação com sua carteira pela cidade e bairro. Endereço
                      incompleto pode impedir identificar o mesmo imóvel.
                    </p>
                    {data.possibleDuplicates.length ? (
                      <ul className="mt-3 grid gap-2">
                        {data.possibleDuplicates.map((p) => (
                          <li key={p.id}>
                            <Link
                              target="_blank"
                              className="text-sm text-green-800 underline"
                              href={`/corretor/imoveis/${p.id}`}
                            >
                              {p.title} · {p.city}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm">
                        Nenhuma correspondência encontrada por esses critérios.
                        Revise antes de continuar.
                      </p>
                    )}
                  </section>
                  <div className="grid gap-2 text-sm font-medium">
                    <label htmlFor="captacao-contact">Contato associado</label>
                    <select
                      id="captacao-contact"
                      className="min-h-11 w-full rounded-lg border bg-white px-3"
                      value={lead}
                      onChange={(e) => setLead(e.target.value)}
                    >
                      <option value="">
                        Selecione conscientemente um contato existente
                      </option>
                      {leads.map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.name || l.phone || "Contato sem nome"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      target="_blank"
                      href="/corretor/clientes"
                      className="text-sm text-green-800 underline"
                    >
                      Cadastrar um novo contato em Clientes
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void loadLeads().catch((e) => setError(e.message))
                      }
                    >
                      Atualizar contatos
                    </Button>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    O formulário existente receberá apenas dados básicos para
                    revisão. Fotos e descrição do anúncio não serão importadas.
                    Use textos próprios e mídias com autorização. O imóvel será
                    salvo como rascunho, sem publicação automática.
                  </p>
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <input
                      className="mt-1.5"
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    Revisei a confirmação, a origem do anúncio e possíveis
                    duplicidades. Quero preparar o cadastro deste imóvel,
                    associado ao contato selecionado.
                  </label>
                  <Button
                    disabled={busy || !reviewed || !lead}
                    onClick={() => void start()}
                  >
                    {busy
                      ? "Preparando…"
                      : "Continuar para o cadastro de imóvel"}
                  </Button>
                </>
              )}
              <Link
                className="text-sm text-green-800 underline"
                href="/corretor/captacao"
              >
                Voltar para Captação
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </BrokerPageShell>
  )
}
