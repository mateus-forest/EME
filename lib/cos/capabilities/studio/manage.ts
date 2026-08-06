import "server-only"

import type { Prisma } from "@prisma/client"

import { resolveCampaignEntity, resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import { createStudioCampaign, getLatestStudioCampaign } from "@/lib/studio-campaigns"
import { prisma } from "@/lib/prisma"

import { cleanText, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import type { CosCapabilityExecutionInput, CosCapabilityHandler } from "@/lib/cos/types"

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

async function resolveStudioPropertyInput(input: {
  brokerId: string
  payload: Record<string, unknown>
  message: string
  pendingInput?: CosCapabilityExecutionInput["pendingInput"]
}) {
  const resolution = await resolvePropertyEntity({
    brokerId: input.brokerId,
    payload: input.payload,
    message: input.message,
    pendingField: input.pendingInput?.field,
    pendingData: input.pendingInput?.parsedData ?? {},
    take: 5,
  })

  if (resolution.record) {
    return { property: resolution.record, needsInput: null as null | { response: string; metadata: Prisma.InputJsonObject } }
  }

  if (resolution.options && resolution.options.length > 1) {
    return {
      property: null,
      needsInput: {
        response: `Encontrei mais de um imÃ³vel. Qual deseja usar?\n\n${resolution.options.map((candidate, index) => `${index + 1}. ${candidate.label}${candidate.description ? ` - ${candidate.description}` : ""}`).join("\n")}`,
        metadata: createPendingInputMetadata({
          field: "propertyChoice",
          action: "STUDIO_GENERATE_CAMPAIGN",
          entity: "property",
          parsedData: {
            ...(resolution.parsedData ?? {}),
            options: resolution.options,
          },
        }) as Prisma.InputJsonObject,
      },
    }
  }

  return {
    property: null,
    needsInput: {
      response: "Qual imÃ³vel devo usar nesta aÃ§Ã£o do Studio IA?",
      metadata: createPendingInputMetadata({
        field: "property",
        action: "STUDIO_GENERATE_CAMPAIGN",
        entity: "property",
      }) as Prisma.InputJsonObject,
    },
  }
}

function buildPropertyNarrative(property: NonNullable<Awaited<ReturnType<typeof resolvePropertyEntity>>["record"]>) {
  const location = [property.neighborhood, property.city].filter(Boolean).join(", ")
  const bathrooms = "bathrooms" in property && typeof property.bathrooms === "number" ? property.bathrooms : 0
  return {
    title: property.title,
    highlight: `${property.bedrooms} dorm., ${bathrooms} banh., ${property.parkingSpots} vaga(s)`,
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

export const studioGenerateDescriptionCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingInput })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imÃ³vel", "propertyId")
  const property = resolved.property

  const narrative = buildPropertyNarrative(property)
  const description = `${narrative.title} em ${narrative.location}, com ${narrative.highlight.toLowerCase()} e valor de referÃªncia em R$ ${(narrative.price / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. ${narrative.description}`

  return {
    response: `DescriÃ§Ã£o sugerida:\n\n${description}`,
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
      metadata: createPendingInputMetadata({
        field: "text",
        action: "STUDIO_IMPROVE_TEXT",
        entity: "studio_ia",
      }),
    }
  }

  const refined = `${baseText}\n\nCTA sugerido: fale comigo para receber a apresentaÃ§Ã£o completa e agendar sua visita.`

  return {
    response: `Texto refinado:\n\n${refined}`,
    metadata: {
      refinedText: refined,
    },
  }
}

export const studioGenerateCampaignCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingInput })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imÃ³vel", "propertyId")
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

export const studioGenerateInstagramCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingInput })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imÃ³vel", "propertyId")
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

export const studioGenerateFacebookCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingInput })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imÃ³vel", "propertyId")
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

export const studioGenerateVideoCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingInput })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imÃ³vel", "propertyId")
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

export const studioGenerateStoryCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const resolved = await resolveStudioPropertyInput({ brokerId, payload: payloadRecord, message, pendingInput })
  if (!resolved.property) return resolved.needsInput ?? requiredSelectionResponse("imÃ³vel", "propertyId")
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
  const propertyResolution = await resolvePropertyEntity({
    brokerId,
    payload: payloadRecord,
    message: "",
    take: 1,
  })
  const propertyId = propertyResolution.record?.id ?? null
  if (!propertyId) return requiredSelectionResponse("imÃ³vel", "propertyId")

  const { user } = await getBrokerUserContext(brokerId, userId)
  if (!user) throw new Error("COS_STUDIO_USER_NOT_FOUND")

  const latest = await getLatestStudioCampaign(user, {
    kind: "INSTAGRAM",
    propertyId,
  })

  if (!latest) {
    const campaignResolution = await resolveCampaignEntity({ brokerId, payload: payloadRecord })
    return {
      response: "NÃ£o encontrei campanha anterior para regenerar. Posso criar uma nova campanha de Instagram primeiro.",
      metadata: createPendingInputMetadata({
        field: "campaignId",
        action: "STUDIO_REGENERATE",
        entity: "studio_ia",
        parsedData: campaignResolution.record ? { campaignId: campaignResolution.record.id } : undefined,
        extra: { propertyId },
      }),
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
    response: `Campanha regenerada com sucesso.\n\nNova versÃ£o: ${regenerated.version}`,
    metadata: {
      campaignId: regenerated.id,
      propertyId,
      previousCampaignId: latest.id,
    },
    propertyId,
  }
}
