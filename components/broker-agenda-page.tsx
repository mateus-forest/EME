"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarDays, CheckCircle2, Clock, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type AgendaEvent = {
  id: string
  title: string
  type: string
  date: string
  time: string
  notes: string
  status: string
  leadName: string
  propertyTitle: string
}

const filters = [
  { label: "Hoje", value: "today" },
  { label: "Amanhã", value: "tomorrow" },
  { label: "Semana", value: "week" },
] as const

export function BrokerAgendaPage() {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("today")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState({
    title: "",
    type: "visit",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    notes: "",
  })

  const loadEvents = useCallback(async (nextFilter = filter) => {
    setIsLoading(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/brokers/agenda?filter=${nextFilter}`, { credentials: "include", cache: "no-store" })
      const data = (await response.json().catch(() => null)) as { events?: AgendaEvent[]; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível carregar a agenda.")
      setEvents(data?.events ?? [])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar a agenda.")
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadEvents(filter)
  }, [filter, loadEvents])

  async function createEvent() {
    if (!draft.title.trim()) {
      setFeedback("Informe o compromisso.")
      return
    }
    setIsSaving(true)
    setFeedback("")
    try {
      const response = await fetch("/api/brokers/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      })
      const data = (await response.json().catch(() => null)) as { event?: AgendaEvent; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar o compromisso.")
      setDraft({ ...draft, title: "", time: "", notes: "" })
      setFeedback("Compromisso criado.")
      await loadEvents()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o compromisso.")
    } finally {
      setIsSaving(false)
    }
  }

  async function markDone(id: string) {
    try {
      const response = await fetch("/api/brokers/agenda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status: "done" }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível atualizar o compromisso.")
      setEvents((current) => current.map((event) => event.id === id ? { ...event, status: "done" } : event))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o compromisso.")
    }
  }

  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
          <CardHeader className="px-5 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <CalendarDays className="size-5 text-[#69F0AE]" />
              Compromissos
            </CardTitle>
            <div className="flex flex-wrap gap-2 pt-3">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${filter === item.value ? "border-[#00C853]/25 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.07]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0">
            {feedback ? <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-[#69F0AE]">{feedback}</p> : null}
            {isLoading ? (
              <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Carregando agenda...</p>
            ) : events.length > 0 ? (
              events.map((event) => (
                <div key={event.id} className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{event.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/50">
                      <Clock className="size-4 text-[#69F0AE]" />
                      {event.date} {event.time || ""}
                      {event.propertyTitle ? `· ${event.propertyTitle}` : ""}
                      {event.leadName ? `· ${event.leadName}` : ""}
                    </p>
                    {event.notes ? <p className="mt-2 line-clamp-2 text-sm text-white/58">{event.notes}</p> : null}
                  </div>
                  <Button type="button" variant="ghost" disabled={event.status === "done"} onClick={() => markDone(event.id)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]">
                    <CheckCircle2 className="size-4" />
                    {event.status === "done" ? "Concluído" : "Marcar feito"}
                  </Button>
                </div>
              ))
            ) : (
              <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Você não tem compromissos nessa data.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
          <CardHeader className="px-5 py-5">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Plus className="size-5 text-[#69F0AE]" />
              Novo compromisso
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0">
            <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex: Visita com João" className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
            <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white">
              <option value="visit" className="bg-[#111]">Visita</option>
              <option value="reminder" className="bg-[#111]">Lembrete</option>
              <option value="event" className="bg-[#111]">Evento</option>
              <option value="task" className="bg-[#111]">Tarefa</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
              <Input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
            </div>
            <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Observações" className="min-h-24 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
            <Button type="button" disabled={isSaving} onClick={createEvent} className="h-10 rounded-xl bg-[#00C853] text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60">
              {isSaving ? "Salvando..." : "Salvar compromisso"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
