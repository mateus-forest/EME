import "server-only"
import { endOfDay, startOfDay } from "date-fns"
import { agendaCard, clientCard, documentCard, propertyCard } from "@/lib/cos-launch/cards"
import type { CosLaunchCard, CosLaunchOption } from "@/lib/cos-launch/types"
import { prisma } from "@/lib/prisma"

const propertySelect = { id: true, title: true, city: true, neighborhood: true, price: true, bedrooms: true, bathrooms: true, parkingSpots: true, status: true, imageUrls: true, legalData: true } as const
const clientSelect = { id: true, name: true, phone: true, whatsapp: true, source: true, status: true, property: { select: { title: true } } } as const
const documentSelect = { id: true, title: true, type: true, status: true, lead: { select: { name: true } }, property: { select: { title: true } } } as const
const agendaSelect = { id: true, title: true, type: true, status: true, date: true, time: true, lead: { select: { name: true } }, property: { select: { title: true } } } as const

export async function listPropertyCards(brokerId: string): Promise<CosLaunchCard[]> { return (await prisma.property.findMany({ where: { brokerId }, orderBy: { updatedAt: "desc" }, take: 6, select: propertySelect })).map(propertyCard) }
export async function listClientCards(brokerId: string): Promise<CosLaunchCard[]> { return (await prisma.lead.findMany({ where: { brokerId }, orderBy: { updatedAt: "desc" }, take: 6, select: clientSelect })).map(clientCard) }
export async function listDocumentCards(brokerId: string, kind?: "contract" | "proposal"): Promise<CosLaunchCard[]> {
  const type = kind === "contract" ? { contains: "contract", mode: "insensitive" as const } : kind === "proposal" ? { contains: "proposal", mode: "insensitive" as const } : undefined
  return (await prisma.brokerDocument.findMany({ where: { brokerId, ...(type ? { type } : {}) }, orderBy: { updatedAt: "desc" }, take: 6, select: documentSelect })).map(documentCard)
}
export async function listTodayAgendaCards(brokerId: string): Promise<CosLaunchCard[]> { const now = new Date(); return (await prisma.agendaEvent.findMany({ where: { brokerId, date: { gte: startOfDay(now), lte: endOfDay(now) } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 8, select: agendaSelect })).map(agendaCard) }
export async function getPropertyCard(brokerId: string, id: string) { const record = await prisma.property.findFirst({ where: { id, brokerId }, select: propertySelect }); return record ? propertyCard(record) : null }
export async function getClientCard(brokerId: string, id: string) { const record = await prisma.lead.findFirst({ where: { id, brokerId }, select: clientSelect }); return record ? clientCard(record) : null }
export async function getDocumentCard(brokerId: string, id: string) { const record = await prisma.brokerDocument.findFirst({ where: { id, brokerId }, select: documentSelect }); return record ? documentCard(record) : null }
export async function getAgendaCard(brokerId: string, id: string) { const record = await prisma.agendaEvent.findFirst({ where: { id, brokerId }, select: agendaSelect }); return record ? agendaCard(record) : null }
export async function getFormOptions(brokerId: string): Promise<{ clients: CosLaunchOption[]; properties: CosLaunchOption[] }> {
  const [clients, properties] = await Promise.all([prisma.lead.findMany({ where: { brokerId }, orderBy: { updatedAt: "desc" }, take: 40, select: { id: true, name: true, phone: true, whatsapp: true } }), prisma.property.findMany({ where: { brokerId }, orderBy: { updatedAt: "desc" }, take: 40, select: { id: true, title: true, city: true, neighborhood: true } })])
  return { clients: clients.map((client) => ({ id: client.id, label: client.name?.trim() || "Cliente sem nome", subtitle: client.whatsapp ?? client.phone ?? undefined })), properties: properties.map((property) => ({ id: property.id, label: property.title, subtitle: [property.neighborhood, property.city].filter(Boolean).join(", ") || undefined })) }
}
