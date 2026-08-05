import "server-only"

import type { Prisma } from "@prisma/client"

import { createStudioCampaign, getLatestStudioCampaign } from "@/lib/studio-campaigns"
import { prisma } from "@/lib/prisma"

import { cleanText, getEntityIdFromPayload, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import type { CosCapabilityExecutionInput, CosCapabilityHandler } from "@/lib/cos/types"

type StudioPropertyCandidate = {
  id: string
  title: string
  city: string
  neighborhood: string | null
}

async function getBrokerUserContext(brokerId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      broker: { select: { id: true } },
      ownedAgency: { select: { id: true } },
    },
  })
  const broker = await prisma.broker.findUnique({
    where: { id: brokerId },
    select: { id: true, user: { select: { name: true } } },
  })

  return { user, broker }
}

async function resolvePropertyForStudio(brokerId: string, payload: Record<string, unknown>) {
  const propertyId = getEntityIdFromPayload(payload, "property")
  if (!propertyId) return null
  return prisma.property.findFirst({ where: { id: propertyId, brokerId } })
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function resolveStudioPropertyChoice(message: string, candidates: StudioPropertyCandidate[]) {
  const normalized = normalizeText(message)
  const numericIndex = /^\d+$/.test(normalized) ? Number(normalized) - 1 : -1
  if (numericIndex >= 0 && candidates[numericIndex]) return candidates[numericIndex]
  if (normalized.includes("primeiro") && candidates[0]) return candidates[0]
  if (normalized.includes("segundo") && candidates[1]) return candidates[1]
  if (normalized.includes("terceiro") && candidates[2]) return candidates[2]

  return (
    candidates.find((candidate) => {
      const title = normalizeText(candidate.title)
      const location = normalizeText(`${candidate.neighborhood ?? ""} ${candidate.city}`)
      return title.includes(normalized) || normalized.includes(title) || location.includes(normalized)
    }) ?? null
  )
}

async function findStudioPropertyCandidates(brokerId: string, message: string) {
  const normalized = normalizeText(message)
  const terms = normalized
    .split(/\s+/)
    .filter((term) => term.length > 2 && !["criar", "gere", "gerar", "campanha", "instagram", "video", "story", "studio", "ia", "imovel", "imovel,"].includes(term))

  return prisma.property.findMany({
    where: {
      brokerId,
      ...(terms.length > 0
        ? {
            OR: terms.flatMap((term) => ([
              { title: { contains: term, mode: "insensitive" as const } },
              { city: { contains: term, mode: "insensitive" as const } },
              { neighborhood: { contains: term, mode: "insensitive" as const } },
            ])),
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      city: true,
      neighborhood: true,
    },
  })
}

async function resolveStudioPropertyInput(input: {
  brokerId: string
  payload: Record<string, unknown>
  message: string
  pendingContext?: CosCapabilityExecutionInput["pendingContext"]
}) {
  const directProperty = await resolvePropertyForStudio(input.brokerId, input.payload)
  if (directProperty) {
    return { property: directProperty, needsInput: null as null | { response: string; metadata: Prisma.InputJsonObject } }
  }

  if (input.pendingContext?.missingField === "propertyChoice" && input.pendingContext.parsedData) {
    const candidates = Array.isArray(input.pendingContext.parsedData.propertyOptions)
      ? input.pendingContext.parsedData.propertyOptions.filter((item): item is StudioPropertyCandidate => {
          return Boolean(
            item &&
              typeof item === "object" &&
              typeof (item as StudioPropertyCandidate).id === "string" &&
              typeof (item as StudioPropertyCandidate).title === "string" &&
              typeof (item as StudioPropertyCandidate).city === "string",
          )
        })
      : []

    const chosen = resolveStudioPropertyChoice(input.message, candidates)
    if (chosen) {
      const property = await prisma.property.findFirst({ where: { id: chosen.id, brokerId: input.brokerId } })
      if (property) {
        return { property, needsInput: null }
      }
    }
  }

  const candidates = await findStudioPropertyCandidates(input.brokerId, input.message)
  if (candidates.length > 1) {
    return {
      property: null,
      needsInput: {
        response: `Encontrei mais de um imóvel. Qual deseja usar?\n\n${candidates.map((candidate, index) => `${index + 1}. ${candidate.title} - ${candidate.neighborhood ?? candidate.city}`).join("\n")}`,
        metadata: {
          required: ["propertyChoice"],
          noCharge: true,
          parsedData: {
            propertyOptions: candidates,
            options: candidates.map((candidate) => ({
              id: candidate.id,
              label: candidate.title,
              description: candidate.neighborhood ?? candidate.city,
            })),
          },
        } satisfies Prisma.InputJsonObject,
      },
    }
  }

  if (candidates.length === 1) {
    const property = await prisma.property.findFirst({ where: { id: candidates[0].id, brokerId: input.brokerId } })
    if (property) {
      return { property, needsInput: null }
    }
  }

  return {
    property: null,
    needsInput: {
      response: "Qual imóvel devo usar nesta ação do Studio IA?",
      metadata: {
        required: ["property"],
        noCharge: true,
      } satisfies Prisma.InputJsonObject,
    },
  }
}

function buildPropertyNarrative(property: NonNullable<Awaited<ReturnType<typeof resolvePropertyForStudio>>>) {
  const location = [property.neighborhood, property.city].filter(Boolean).join(", ")
  return {
    title: property.title,
    highlight: `${property.bedrooms} dorm., ${property.bathrooms} banh., ${property.parkingSpots} vaga(s)`,
    location: location || property.city,
    price: property.price,
    description:
      property.description?.trim() ||
      `${property.title} com foco em ${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ""}.`,
  }
}

async function createDeterministicStudioCampaign(input: {
  brokerId: string
  userId: string
  propertyId: string
  kind: "INSTAGRAM" | "SELL_PROPERTY" | "VIDEO"
  goal: string
  prompt: string
  assets: Array<{
    assetKey: string
    label: string
    type: "COPY" | "STORY" | "VIDEO"
    content: Prisma.InputJsonValue
  }>
}) {
  const { user } = await getBrokerUserContext(input.brokerId, input.userId)
  if (!user) {
    throw new Error("COS_STUDIO_USER_NOT_FOUND")
  }

  return createStudioCampaign(user, {
    kind: input.kind,
    goal: input.goal,
    prompt: input.prompt,
    promptRevised: input.prompt,
    provider: "eme-cos",
    model: "deterministic-workflow",
    sourceRoute: "/api/assistant/eme",
    propertyId: input.propertyId,
    assets: input.assets.map((asset) => ({
      assetKey: asset.assetKey,
      label: asset.label,
      type: asset.type,
      provider: "eme-cos",
      model: "deterministic-workflow",
      status: "PENDING_REVIEW",
      content: asset.content,
      metadata: {
        generatedBy: "cos",
      },
    })),
  })
}

export const studioGenerateDescriptionCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingContext })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imóvel", "propertyId")
  const property = resolved.property

  const narrative = buildPropertyNarrative(property)
  const description = `${narrative.title} em ${narrative.location}, com ${narrative.highlight.toLowerCase()} e valor de referência em R$ ${(narrative.price / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. ${narrative.description}`

  return {
    response: `Descrição sugerida:\n\n${description}`,
    metadata: {
      propertyId: property.id,
      generatedDescription: description,
    },
    propertyId: property.id,
  }
}

export const studioImproveTextCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const baseText = cleanText(payloadRecord.text, 2400) || cleanText(message, 2400)
  if (!baseText) {
    return {
      response: "Envie o texto que deseja refinar para eu melhorar a copy.",
      metadata: {
        required: ["text"],
        noCharge: true,
      },
    }
  }

  const refined = `${baseText}\n\nCTA sugerido: fale comigo para receber a apresentação completa e agendar sua visita.`

  return {
    response: `Texto refinado:\n\n${refined}`,
    metadata: {
      refinedText: refined,
    },
  }
}

export const studioGenerateCampaignCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingContext })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imóvel", "propertyId")
  const property = resolved.property

  const narrative = buildPropertyNarrative(property)
  const campaign = await createDeterministicStudioCampaign({
    brokerId,
    userId,
    propertyId: property.id,
    kind: "SELL_PROPERTY",
    goal: `Vender ${property.title}`,
    prompt: `Campanha de venda para ${property.title} em ${narrative.location}.`,
    assets: [
      {
        assetKey: "main_campaign",
        label: "Plano principal",
        type: "COPY",
        content: {
          strategy: `Destacar ${narrative.title} para compradores qualificados em ${narrative.location}.`,
          caption: `${narrative.title} com ${narrative.highlight.toLowerCase()} em ${narrative.location}.`,
        },
      },
      {
        assetKey: "whatsapp_pitch",
        label: "WhatsApp",
        type: "COPY",
        content: {
          text: `Tenho uma oportunidade em ${narrative.location}: ${narrative.title}. Posso te enviar os detalhes?`,
        },
      },
    ],
  })

  return {
    response: `Campanha base criada no Studio IA.\n\n${campaign.title}\nAssets: ${campaign.assets.length}`,
    metadata: {
      campaignId: campaign.id,
      propertyId: property.id,
      assetCount: campaign.assets.length,
    },
    propertyId: property.id,
  }
}

export const studioGenerateInstagramCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingContext })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imóvel", "propertyId")
  const property = resolved.property

  const narrative = buildPropertyNarrative(property)
  const campaign = await createDeterministicStudioCampaign({
    brokerId,
    userId,
    propertyId: property.id,
    kind: "INSTAGRAM",
    goal: `Instagram | ${property.title}`,
    prompt: `Campanha de Instagram para ${property.title}.`,
    assets: [
      {
        assetKey: "post_feed",
        label: "Post feed",
        type: "COPY",
        content: {
          title: narrative.title,
          highlight: narrative.highlight,
          support: narrative.location,
        },
      },
      {
        assetKey: "story",
        label: "Story",
        type: "STORY",
        content: {
          kicker: "Novo destaque",
          line1: narrative.title,
          line2: `Confira em ${narrative.location}`,
        },
      },
    ],
  })

  return {
    response: `Campanha de Instagram criada.\n\n${campaign.title}\nAssets: ${campaign.assets.length}`,
    metadata: {
      campaignId: campaign.id,
      propertyId: property.id,
      assetCount: campaign.assets.length,
    },
    propertyId: property.id,
  }
}

export const studioGenerateFacebookCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingContext })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imóvel", "propertyId")
  const property = resolved.property

  return {
    response: `Campanha de Facebook preparada para ${property.title}.\n\nUse a mesma base aprovada de Instagram com foco em alcance local.`,
    metadata: {
      propertyId: property.id,
      channel: "facebook",
    },
    propertyId: property.id,
  }
}

export const studioGenerateVideoCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingContext })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imóvel", "propertyId")
  const property = resolved.property

  const narrative = buildPropertyNarrative(property)
  const campaign = await createDeterministicStudioCampaign({
    brokerId,
    userId,
    propertyId: property.id,
    kind: "VIDEO",
    goal: `Video | ${property.title}`,
    prompt: `Video comercial para ${property.title}.`,
    assets: [
      {
        assetKey: "video_script",
        label: "Roteiro",
        type: "VIDEO",
        content: {
          opening: `Apresente ${narrative.title} em ${narrative.location}.`,
          middle: `Destaque ${narrative.highlight.toLowerCase()} e contexto comercial.`,
          ending: "Finalize com chamada para visita e contato direto.",
        },
      },
    ],
  })

  return {
    response: `Roteiro de video criado.\n\n${campaign.title}`,
    metadata: {
      campaignId: campaign.id,
      propertyId: property.id,
    },
    propertyId: property.id,
  }
}

export const studioGenerateStoryCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingContext })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imóvel", "propertyId")
  const property = resolved.property

  const narrative = buildPropertyNarrative(property)

  return {
    response: `Story sugerido:\n\nNovo destaque\n${narrative.title}\n${narrative.location}`,
    metadata: {
      propertyId: property.id,
      story: {
        kicker: "Novo destaque",
        line1: narrative.title,
        line2: narrative.location,
      },
    },
    propertyId: property.id,
  }
}

export const studioRegenerateCapability: CosCapabilityHandler = async ({ brokerId, userId, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message: "", action: "general", payload })
  const propertyId = getEntityIdFromPayload(payloadRecord, "property")
  if (!propertyId) return requiredSelectionResponse("imóvel", "propertyId")

  const { user } = await getBrokerUserContext(brokerId, userId)
  if (!user) throw new Error("COS_STUDIO_USER_NOT_FOUND")

  const latest = await getLatestStudioCampaign(user, {
    kind: "INSTAGRAM",
    propertyId,
  })

  if (!latest) {
    return {
      response: "Não encontrei campanha anterior para regenerar. Posso criar uma nova campanha de Instagram primeiro.",
      metadata: {
        required: ["campaignId"],
        noCharge: true,
        propertyId,
      },
      propertyId,
    }
  }

  const regenerated = await createStudioCampaign(user, {
    kind: latest.kind,
    goal: latest.goal,
    prompt: latest.prompt,
    promptRevised: latest.promptRevised,
    provider: latest.provider,
    model: latest.model,
    sourceRoute: latest.sourceRoute,
    propertyId: latest.propertyId,
    version: latest.version + 1,
    assets: latest.assets.map((asset) => ({
      assetKey: asset.assetKey,
      label: asset.label ?? asset.assetKey,
      type: asset.type,
      provider: asset.provider,
      model: asset.model,
      status: "PENDING_REVIEW",
      content: (asset.content ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: {
        regeneratedFromCampaignId: latest.id,
      },
    })),
  })

  return {
    response: `Campanha regenerada com sucesso.\n\nNova versão: ${regenerated.version}`,
    metadata: {
      campaignId: regenerated.id,
      propertyId,
      previousCampaignId: latest.id,
    },
    propertyId,
  }
}
