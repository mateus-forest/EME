import type { CosLaunchCard } from "@/lib/cos-launch/types"

type PropertyInput = { id: string; title: string; city: string | null; neighborhood: string | null; price: number | null; bedrooms: number | null; bathrooms: number | null; parkingSpots: number | null; status: string; imageUrls: unknown; legalData: unknown }
type ClientInput = { id: string; name: string | null; phone: string | null; whatsapp: string | null; source: string | null; status: string; property: { title: string } | null }
type DocumentInput = { id: string; title: string; type: string; status: string; lead: { name: string | null } | null; property: { title: string } | null }
type AgendaInput = { id: string; title: string; type: string; status: string; date: Date; time: string | null; lead: { name: string | null } | null; property: { title: string } | null }

const statuses: Record<string, string> = { DRAFT: "Rascunho", ACTIVE: "Ativo", INACTIVE: "Inativo", PUBLISHED: "Publicado", NEW: "Novo interessado", CONTACTED: "Em atendimento", QUALIFIED: "Em negociação", WON: "Vendido", LOST: "Perdido", ARCHIVED: "Arquivado", PENDING: "Pendente", COMPLETED: "Concluído", CANCELLED: "Cancelado", SIGNED: "Assinado", SENT: "Enviado" }
const status = (value: string) => statuses[value.toUpperCase()] ?? value.replace(/_/g, " ").toLowerCase()
const currency = (value: number | null) => typeof value === "number" ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100) : "Não informado"
const location = (city: string | null, neighborhood: string | null) => [neighborhood, city].filter(Boolean).join(", ") || "Localização não informada"
const image = (value: unknown) => Array.isArray(value) ? value.find((item): item is string => typeof item === "string" && item.length > 0) : undefined
function area(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const data = value as Record<string, unknown>; const candidate = data.privateArea ?? data.totalArea ?? data.area; return typeof candidate === "number" || typeof candidate === "string" ? `${candidate} m²` : null }
function phone(value: string | null) { if (!value) return "Não informado"; const digits = value.replace(/\D/g, ""); if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`; if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`; return value }
function source(value: string | null) { const normalized = value?.toLowerCase() ?? ""; if (normalized.includes("marketplace")) return "Marketplace"; if (normalized.includes("catalog")) return "Catálogo"; if (normalized.includes("cos") || normalized.includes("assessor")) return "COS"; return "Manual" }

export function propertyCard(property: PropertyInput): CosLaunchCard {
  const details = [property.bedrooms ? `${property.bedrooms} quarto${property.bedrooms === 1 ? "" : "s"}` : null, property.parkingSpots ? `${property.parkingSpots} vaga${property.parkingSpots === 1 ? "" : "s"}` : null, area(property.legalData)].filter((item): item is string => Boolean(item))
  return { kind: "property", id: property.id, title: property.title, subtitle: location(property.city, property.neighborhood), imageUrl: image(property.imageUrls), status: status(property.status), meta: [{ label: "Valor", value: currency(property.price) }, ...(details.length ? [{ label: "Características", value: details.join(" · ") }] : [])], href: `/corretor/imoveis?propertyId=${encodeURIComponent(property.id)}`, ctaLabel: "Ver imóvel" }
}
export function clientCard(client: ClientInput): CosLaunchCard {
  return { kind: "client", id: client.id, title: client.name?.trim() || "Cliente sem nome", subtitle: client.property?.title ?? "Sem imóvel vinculado", status: status(client.status), meta: [{ label: "WhatsApp", value: phone(client.whatsapp ?? client.phone) }, { label: "Origem", value: source(client.source) }], href: `/corretor/clientes?leadId=${encodeURIComponent(client.id)}`, ctaLabel: "Ver cliente" }
}
export function documentCard(document: DocumentInput): CosLaunchCard {
  const lower = document.type.toLowerCase(); const isProposal = lower.includes("proposal") || lower.includes("proposta"); const isContract = lower.includes("contract") || lower.includes("contrato"); const kind = isProposal ? "proposal" : isContract ? "contract" : "document"; const href = isProposal ? "/corretor/propostas" : isContract ? "/corretor/contratos" : "/corretor/documentos"
  return { kind, id: document.id, title: document.title, subtitle: [document.lead?.name, document.property?.title].filter(Boolean).join(" · ") || "Sem vínculo", status: status(document.status), meta: [{ label: "Tipo", value: isProposal ? "Proposta" : isContract ? "Contrato" : "Documento" }], href: `${href}?documentId=${encodeURIComponent(document.id)}`, ctaLabel: isProposal ? "Abrir proposta" : isContract ? "Abrir contrato" : "Abrir" }
}
export function agendaCard(event: AgendaInput): CosLaunchCard {
  return { kind: "agenda", id: event.id, title: event.title, subtitle: [event.lead?.name, event.property?.title].filter(Boolean).join(" · ") || "Compromisso interno", status: status(event.status), meta: [{ label: "Horário", value: event.time || "Horário não informado" }, { label: "Tipo", value: event.type.replace(/_/g, " ") }], href: "/corretor/compromissos", ctaLabel: "Ver agenda" }
}
