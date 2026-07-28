"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  MapPinned,
  RotateCcw,
  Sparkles,
  Tag,
  XCircle,
} from "lucide-react"

import {
  appointments,
  type Appointment,
  type AppointmentDraft,
  type AppointmentFilter,
  type AppointmentStatus,
  type AppointmentType,
} from "@/lib/appointments-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const filters: Array<{ label: string; value: AppointmentFilter }> = [
  { label: "Hoje", value: "today" },
  { label: "Amanha", value: "tomorrow" },
  { label: "Semana", value: "week" },
  { label: "Todos", value: "all" },
]

const appointmentTypeLabels: Record<AppointmentType, string> = {
  visit: "Visita",
  reminder: "Lembrete",
  event: "Evento",
  task: "Tarefa",
}

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  done: "Concluido",
  cancelled: "Cancelado",
}

const appointmentTypeTone: Record<AppointmentType, string> = {
  visit: "bg-[#009b3a]/10 text-[#009b3a]",
  reminder: "bg-[#f1efe8] text-[#6B7280]",
  event: "bg-[#eef5ff] text-[#3267d6]",
  task: "bg-[#f7f1e8] text-[#9a6b22]",
}

const appointmentStatusTone: Record<AppointmentStatus, string> = {
  pending: "bg-[#eef8f1] text-[#009b3a]",
  done: "bg-[#eef5ff] text-[#3267d6]",
  cancelled: "bg-[#f5f5f5] text-[#7B8491]",
}

function createEmptyDraft() {
  return {
    title: "",
    type: "visit" as AppointmentType,
    date: new Date().toISOString().slice(0, 10),
    time: "",
    notes: "",
  }
}

export function BrokerAgendaPage() {
  const [events, setEvents] = useState<Appointment[]>([])
  const [filter, setFilter] = useState<AppointmentFilter>("today")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AppointmentDraft>(createEmptyDraft())

  const loadEvents = useCallback(async (nextFilter: AppointmentFilter) => {
    setIsLoading(true)
    setFeedback("")
    try {
      const loadedEvents = await appointments.list(nextFilter)
      setEvents(loadedEvents)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar os compromissos.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents(filter)
  }, [filter, loadEvents])

  const metrics = useMemo(() => {
    const pending = events.filter((event) => event.status === "pending").length
    const done = events.filter((event) => event.status === "done").length
    const cancelled = events.filter((event) => event.status === "cancelled").length

    return [
      { label: "Pendentes", value: String(pending), tone: "text-[#009b3a]" },
      { label: "Concluidos", value: String(done), tone: "text-[#050505]" },
      { label: "Cancelados", value: String(cancelled), tone: "text-[#7B8491]" },
    ]
  }, [events])

  const isEditing = Boolean(editingId)
  const nextUpcoming = useMemo(
    () => events.find((event) => event.status === "pending") ?? null,
    [events],
  )

  function resetForm() {
    setEditingId(null)
    setDraft(createEmptyDraft())
  }

  function startEditing(event: Appointment) {
    setEditingId(event.id)
    setDraft({
      title: event.title,
      type: event.type,
      date: event.date,
      time: event.time,
      notes: event.notes,
    })
    setFeedback("")
  }

  async function submitForm() {
    if (!draft.title.trim()) {
      setFeedback("Informe o compromisso.")
      return
    }

    setIsSaving(true)
    setFeedback("")

    try {
      const savedEvent = editingId
        ? await appointments.update(editingId, draft)
        : await appointments.create(draft)

      setEvents((current) => {
        if (!editingId) {
          return sortAppointments([savedEvent, ...current])
        }
        return sortAppointments(current.map((event) => (event.id === savedEvent.id ? savedEvent : event)))
      })

      setFeedback(editingId ? "Compromisso atualizado." : "Compromisso criado.")
      resetForm()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel salvar o compromisso.")
    } finally {
      setIsSaving(false)
    }
  }

  async function updateStatus(id: string, action: "complete" | "cancel" | "reopen") {
    setFeedback("")

    try {
      const updatedEvent =
        action === "complete"
          ? await appointments.complete(id)
          : action === "cancel"
            ? await appointments.cancel(id)
            : await appointments.update(id, { status: "pending" })

      setEvents((current) => sortAppointments(current.map((event) => (event.id === updatedEvent.id ? updatedEvent : event))))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar o compromisso.")
    }
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0">
          <CardHeader className="gap-4 px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                  <CalendarDays className="size-5 text-[#009b3a]" />
                  Compromissos
                </CardTitle>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Veja o que precisa de atencao agora e conclua o essencial sem excesso de informacao.
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {metrics.map((item) => (
                  <div
                    key={item.label}
                    className="min-w-0 rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#7B8491]">{item.label}</p>
                    <p className={`mt-1 text-sm font-semibold ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    filter === item.value
                      ? "border-[#009b3a]/25 bg-[#009b3a]/10 text-[#009b3a]"
                      : "border-black/[0.06] bg-[#fbfbf8] text-[#5F6B7A] hover:bg-[#f6f7f4]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="grid gap-3 p-5 pt-0">
            {feedback ? (
              <p className="rounded-[1rem] border border-[#009b3a]/16 bg-[#009b3a]/[0.06] px-4 py-3 text-sm text-[#009b3a]">
                {feedback}
              </p>
            ) : null}

            {isLoading ? (
              <EmeLoading compact message="Carregando compromissos..." />
            ) : events.length > 0 ? (
              events.map((event) => (
                <article
                  key={event.id}
                  className="grid gap-4 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${appointmentTypeTone[event.type]}`}>
                          {appointmentTypeLabels[event.type]}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${appointmentStatusTone[event.status]}`}>
                          {appointmentStatusLabels[event.status]}
                        </span>
                      </div>

                      <p className="mt-3 text-base font-semibold text-[#050505]">{event.title}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#5F6B7A]">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="size-4 text-[#009b3a]" />
                          {formatAppointmentDate(event.date, event.time)}
                        </span>
                        {event.propertyTitle ? (
                          <span className="inline-flex items-center gap-2">
                            <MapPinned className="size-4 text-[#7B8491]" />
                            {event.propertyTitle}
                          </span>
                        ) : null}
                        {event.leadName ? (
                          <span className="inline-flex items-center gap-2">
                            <Tag className="size-4 text-[#7B8491]" />
                            {event.leadName}
                          </span>
                        ) : null}
                      </div>

                      {event.notes ? (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#6B7280]">{event.notes}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => startEditing(event)}
                        className="h-9 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                      >
                        <Edit3 className="size-4" />
                        Editar
                      </Button>

                      {event.status === "pending" ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => updateStatus(event.id, "complete")}
                            className="h-9 rounded-xl border border-[#009b3a]/18 bg-[#eef8f1] px-3 text-[#009b3a] hover:bg-[#e7f6ec]"
                          >
                            <CheckCircle2 className="size-4" />
                            Concluir
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => updateStatus(event.id, "cancel")}
                            className="h-9 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-[#6B7280] hover:bg-white"
                          >
                            <XCircle className="size-4" />
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => updateStatus(event.id, "reopen")}
                          className="h-9 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                        >
                          <RotateCcw className="size-4" />
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyAppointmentsState filter={filter} />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-lg text-[#050505]">{isEditing ? "Editar compromisso" : "Novo compromisso"}</CardTitle>
              <p className="text-sm text-[#6B7280]">
                {isEditing
                  ? "Atualize apenas o necessario. O restante da agenda continua intacto."
                  : "Crie um compromisso em poucos campos e siga com a operacao."}
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              <Input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: Visita com cliente comprador"
                className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={draft.type}
                  onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as AppointmentType }))}
                  className="h-11 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-sm text-[#050505]"
                >
                  {Object.entries(appointmentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value} className="bg-white">
                      {label}
                    </option>
                  ))}
                </select>

                <Input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                  className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]"
                />

                <Input
                  type="time"
                  value={draft.time}
                  onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                  className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]"
                />
              </div>

              <Textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Observacao opcional"
                className="min-h-24 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]"
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={submitForm}
                  className="h-11 flex-1 rounded-xl bg-[#009b3a] text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                >
                  {isSaving ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Criar compromisso"}
                </Button>

                {isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                    className="h-11 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                  >
                    Cancelar edicao
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-[#fbfbf8] py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#050505]">
                <Sparkles className="size-5 text-[#009b3a]" />
                Proximo foco
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {nextUpcoming ? (
                <div className="rounded-[1.25rem] border border-black/[0.06] bg-white/75 p-4">
                  <p className="text-sm font-semibold text-[#050505]">{nextUpcoming.title}</p>
                  <p className="mt-2 text-sm text-[#6B7280]">{formatAppointmentDate(nextUpcoming.date, nextUpcoming.time)}</p>
                  {nextUpcoming.notes ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6B7280]">{nextUpcoming.notes}</p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-[#009b3a]/16 bg-[#009b3a]/[0.06] p-4 text-sm leading-6 text-[#009b3a]">
                  Nenhum compromisso pendente agora. Quando voce criar ou reabrir um item, ele aparece aqui.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function sortAppointments(events: Appointment[]) {
  return [...events].sort((left, right) => {
    const leftKey = `${left.date} ${left.time || "99:99"}`
    const rightKey = `${right.date} ${right.time || "99:99"}`
    return leftKey.localeCompare(rightKey)
  })
}

function formatAppointmentDate(dateValue: string, time: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return time || "Data nao informada"

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const label =
    date.getTime() === today.getTime()
      ? "Hoje"
      : date.getTime() === tomorrow.getTime()
        ? "Amanha"
        : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })

  return `${label}${time ? ` as ${time}` : ""}`
}

function EmptyAppointmentsState({ filter }: { filter: AppointmentFilter }) {
  const message =
    filter === "today"
      ? "Nenhum compromisso para hoje."
      : filter === "tomorrow"
        ? "Nenhum compromisso para amanha."
        : filter === "week"
          ? "Sua semana esta livre por enquanto."
          : "Nenhum compromisso cadastrado ainda."

  return (
    <div className="rounded-[1.25rem] border border-[#009b3a]/16 bg-[#009b3a]/[0.06] p-5 text-sm leading-6 text-[#009b3a]">
      <CheckCircle2 className="mb-3 size-5" />
      {message}
    </div>
  )
}
