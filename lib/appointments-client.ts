"use client"

export type AppointmentType = "visit" | "reminder" | "event" | "task"
export type AppointmentStatus = "pending" | "done" | "cancelled"
export type AppointmentFilter = "all" | "today" | "tomorrow" | "week"

export type Appointment = {
  id: string
  title: string
  type: AppointmentType
  date: string
  time: string
  notes: string
  status: AppointmentStatus
  leadId: string | null
  propertyId: string | null
  leadName: string
  propertyTitle: string
  createdAt: string
  updatedAt: string
}

export type AppointmentDraft = {
  title: string
  type: AppointmentType
  date: string
  time: string
  notes: string
  leadId?: string
  propertyId?: string
}

type AppointmentResponse = {
  event?: Appointment
  events?: Appointment[]
  error?: string
}

async function parseAppointmentResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as AppointmentResponse | null
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar os compromissos.")
  }
  return data ?? {}
}

export const appointments = {
  async list(filter: AppointmentFilter) {
    const response = await fetch(`/api/brokers/agenda?filter=${filter}`, {
      credentials: "include",
      cache: "no-store",
    })
    const data = await parseAppointmentResponse(response)
    return data.events ?? []
  },

  async create(payload: AppointmentDraft) {
    const response = await fetch("/api/brokers/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    const data = await parseAppointmentResponse(response)
    if (!data.event) {
      throw new Error("Nao foi possivel salvar o compromisso.")
    }
    return data.event
  },

  async update(id: string, payload: Partial<AppointmentDraft> & { status?: AppointmentStatus }) {
    const response = await fetch("/api/brokers/agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...payload }),
    })
    const data = await parseAppointmentResponse(response)
    if (!data.event) {
      throw new Error("Nao foi possivel atualizar o compromisso.")
    }
    return data.event
  },

  async complete(id: string) {
    return appointments.update(id, { status: "done" })
  },

  async cancel(id: string) {
    return appointments.update(id, { status: "cancelled" })
  },
}
