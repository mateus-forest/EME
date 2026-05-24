"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Copy, FileText, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type BrokerDocument = {
  id: string
  type: string
  title: string
  content: string
  status: string
  leadName: string
  propertyTitle: string
  createdAt: string
}

const statuses = [
  { label: "Todos", value: "all" },
  { label: "Rascunhos", value: "draft" },
  { label: "Assinados", value: "signed" },
] as const

export function BrokerDocumentsPage() {
  const [documents, setDocuments] = useState<BrokerDocument[]>([])
  const [selectedDocument, setSelectedDocument] = useState<BrokerDocument | null>(null)
  const [status, setStatus] = useState<(typeof statuses)[number]["value"]>("all")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState({ title: "", conditions: "" })

  const loadDocuments = useCallback(async (nextStatus = status) => {
    setIsLoading(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/brokers/documents?status=${nextStatus}`, { credentials: "include", cache: "no-store" })
      const data = (await response.json().catch(() => null)) as { documents?: BrokerDocument[]; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível carregar documentos.")
      setDocuments(data?.documents ?? [])
      setSelectedDocument((current) => current ?? data?.documents?.[0] ?? null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar documentos.")
    } finally {
      setIsLoading(false)
    }
  }, [status])

  useEffect(() => {
    loadDocuments(status)
  }, [status, loadDocuments])

  async function createProposal() {
    setIsSaving(true)
    setFeedback("")
    try {
      const response = await fetch("/api/brokers/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      })
      const data = (await response.json().catch(() => null)) as { document?: BrokerDocument; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível gerar a proposta.")
      setDraft({ title: "", conditions: "" })
      setFeedback("Proposta gerada em rascunho.")
      await loadDocuments()
      if (data?.document) setSelectedDocument(data.document)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível gerar a proposta.")
    } finally {
      setIsSaving(false)
    }
  }

  async function markSigned(id: string) {
    try {
      const response = await fetch("/api/brokers/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status: "signed" }),
      })
      const data = (await response.json().catch(() => null)) as { document?: BrokerDocument; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível atualizar o documento.")
      setDocuments((current) => current.map((document) => document.id === id ? { ...document, status: "signed" } : document))
      setSelectedDocument((current) => current?.id === id ? { ...current, status: "signed" } : current)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o documento.")
    }
  }

  async function copyContent() {
    if (!selectedDocument) return
    await navigator.clipboard.writeText(selectedDocument.content).catch(() => null)
    setFeedback("Texto copiado.")
  }

  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
          <CardHeader className="px-5 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <FileText className="size-5 text-[#69F0AE]" />
              Documentos
            </CardTitle>
            <div className="flex flex-wrap gap-2 pt-3">
              {statuses.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatus(item.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${status === item.value ? "border-[#00C853]/25 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.07]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0">
            {feedback ? <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-[#69F0AE]">{feedback}</p> : null}
            {isLoading ? (
              <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Carregando documentos...</p>
            ) : documents.length > 0 ? (
              documents.map((document) => (
                <button key={document.id} type="button" onClick={() => setSelectedDocument(document)} className={`rounded-[1.25rem] border p-4 text-left transition ${selectedDocument?.id === document.id ? "border-[#00C853]/25 bg-[#00C853]/10" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <p className="truncate font-semibold text-white">{document.title}</p>
                  <p className="mt-1 text-sm text-white/50">{document.status === "signed" ? "Assinado" : "Rascunho"} {document.leadName ? `· ${document.leadName}` : ""}</p>
                </button>
              ))
            ) : (
              <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Nenhum documento encontrado.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-4">
          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Plus className="size-5 text-[#69F0AE]" />
                Gerar proposta
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Título da proposta" className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
              <Textarea value={draft.conditions} onChange={(event) => setDraft({ ...draft, conditions: event.target.value })} placeholder="Condições da proposta" className="min-h-24 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
              <Button type="button" disabled={isSaving} onClick={createProposal} className="h-10 rounded-xl bg-[#00C853] text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60">
                {isSaving ? "Gerando..." : "Gerar proposta"}
              </Button>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-lg text-white">{selectedDocument?.title ?? "Documento"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              {selectedDocument ? (
                <>
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-7 text-white/70">{selectedDocument.content}</pre>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="ghost" onClick={copyContent} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]">
                      <Copy className="size-4" />
                      Copiar texto
                    </Button>
                    <Button type="button" variant="ghost" disabled={selectedDocument.status === "signed"} onClick={() => markSigned(selectedDocument.id)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]">
                      <CheckCircle2 className="size-4" />
                      {selectedDocument.status === "signed" ? "Assinado" : "Marcar assinado"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Selecione ou gere um documento.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
