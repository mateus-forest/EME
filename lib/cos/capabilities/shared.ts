import "server-only"

import type { Prisma } from "@prisma/client"

import { formatCurrencyBRLFromCents } from "@/lib/currency"
import { prisma } from "@/lib/prisma"

import type { CosCapabilityExecutionInput, CosWorkspaceContext, CosWorkspaceEntity } from "@/lib/cos/types"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getPayloadRecord(input: CosCapabilityExecutionInput) {
  return asRecord(input.payload)
}

export function getWorkspaceFromPayload(payload: Record<string, unknown>): CosWorkspaceContext | null {
  const workspace = asRecord(payload.workspace)
  if (!workspace.surface || !workspace.page || !workspace.entity) return null

  return {
    surface: cleanText(workspace.surface, 40) as CosWorkspaceContext["surface"],
    page: cleanText(workspace.page, 120),
    entity: cleanText(workspace.entity, 80) as CosWorkspaceEntity,
    entityId: cleanText(workspace.entityId, 191) || null,
    selection: Array.isArray(workspace.selection)
      ? workspace.selection
          .map((item) => asRecord(item))
          .filter((item) => item.entity && item.entityId)
          .map((item) => ({
            entity: cleanText(item.entity, 80) as CosWorkspaceEntity,
            entityId: cleanText(item.entityId, 191),
            label: cleanText(item.label, 160) || undefined,
          }))
      : [],
    pendingEntity: cleanText(workspace.pendingEntity, 80) as CosWorkspaceEntity | null,
    pendingEntityId: cleanText(workspace.pendingEntityId, 191) || null,
    metadata: asRecord(workspace.metadata),
  }
}

function getWorkspaceSelectionEntityId(workspace: CosWorkspaceContext | null, entity: CosWorkspaceEntity) {
  if (!workspace) return null
  return workspace.selection.find((item) => item.entity === entity)?.entityId ?? null
}

export function getEntityIdFromPayload(payload: Record<string, unknown>, entity: CosWorkspaceEntity) {
  const workspace = getWorkspaceFromPayload(payload)
  const directKeys: Partial<Record<CosWorkspaceEntity, string[]>> = {
    property: ["propertyId"],
    lead: ["leadId"],
    contract: ["contractId", "documentId"],
    agenda: ["agendaEventId", "eventId"],
  }

  const directId =
    directKeys[entity]?.map((key: string) => cleanText(payload[key], 191)).find(Boolean) ||
    (workspace?.entity === entity ? workspace.entityId ?? "" : "") ||
    getWorkspaceSelectionEntityId(workspace, entity) ||
    ""

  return directId || null
}

export function formatCurrency(value: number | null | undefined) {
  return formatCurrencyBRLFromCents(Math.max(0, value ?? 0))
}

export function requiredSelectionResponse(entityLabel: string, field: string, metadata?: Prisma.InputJsonObject) {
  return {
    response: `Preciso saber qual ${entityLabel} devo usar para continuar.`,
    metadata: {
      required: [field],
      noCharge: true,
      ...(metadata ?? {}),
    } satisfies Prisma.InputJsonObject,
  }
}

export async function getBrokerWorkspaceSummary(brokerId: string) {
  const [broker, properties, leads, events, contracts] = await Promise.all([
    prisma.broker.findUnique({
      where: { id: brokerId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        financialConfig: true,
      },
    }),
    prisma.property.findMany({
      where: { brokerId },
      include: { _count: { select: { leads: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: { brokerId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.catalogEvent.groupBy({
      by: ["eventType"],
      where: { brokerId },
      _count: { _all: true },
    }),
    prisma.brokerDocument.findMany({
      where: { brokerId, type: "contract" },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ])

  return {
    broker,
    properties,
    leads,
    events,
    contracts,
  }
}

export function extractPriceFromMessage(message: string) {
  const match = normalizeText(message).match(/(\d{2,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[ ]?(?:mil|milhao|milhoes))/)
  if (!match) return null

  const raw = match[1]
  if (raw.includes("milhao")) {
    const base = Number(raw.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."))
    return Number.isFinite(base) ? Math.round(base * 100_000_000) : null
  }

  if (raw.includes("mil")) {
    const base = Number(raw.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."))
    return Number.isFinite(base) ? Math.round(base * 100_000) : null
  }

  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\./g, "")
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value > 10_000 ? Math.round(value * 100) : Math.round(value * 100_000)
}
