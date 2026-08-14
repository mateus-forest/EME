import "server-only"

import { buildProposalHtml } from "@/lib/proposal-template"
import { prisma } from "@/lib/prisma"

import { createCosAwaitingInputResult, createCosSuccessResult } from "@/lib/cos/action-result"
import { cleanText, getPayloadRecord } from "@/lib/cos/capabilities/shared"
import { resolveLeadEntity, resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPendingInput } from "@/lib/cos/pending-input"
import { firstImageUrl } from "@/lib/cos/runtime-helpers"
import type { CosCapabilityHandler } from "@/lib/cos/types"

export const createProposalCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const pendingData = pendingInput?.action === "CREATE_PROPOSAL" ? pendingInput.parsedData ?? {} : {}
  const pendingOptions = pendingInput?.action === "CREATE_PROPOSAL" ? pendingInput.options ?? null : null

  const [broker, leadResolution] = await Promise.all([
    prisma.broker.findUnique({
      where: { id: brokerId },
      include: { user: { select: { name: true, email: true, photoUrl: true } } },
    }),
    resolveLeadEntity({
      brokerId,
      message,
      payload: payloadRecord,
      pendingField: pendingInput?.field ?? null,
      pendingData,
      pendingOptions,
      take: 4,
    }),
  ])

  if ((leadResolution.recordIds?.length ?? 0) > 1 && leadResolution.options) {
    const proposalPending = createPendingInput({
      field: "lead",
      action: "CREATE_PROPOSAL",
      entity: "proposal",
      capabilityId: "proposal.create",
      parsedData: {
        ...leadResolution.parsedData,
        leadIds: leadResolution.recordIds ?? [],
      },
      options: leadResolution.options,
    })
    return createCosAwaitingInputResult({
      response: `Encontrei mais de um cliente. Qual deles devo usar?\n\n${leadResolution.options.map((option, index) => `${index + 1}. ${option.label}${option.description ? ` - ${option.description}` : ""}`).join("\n")}`,
      pendingInput: proposalPending,
    })
  }

  const lead = leadResolution.record
  const personName = cleanText(leadResolution.parsedData?.personName, 120)

  if (!lead && !personName) {
    const proposalPending = createPendingInput({
      field: "lead",
      action: "CREATE_PROPOSAL",
      entity: "proposal",
      capabilityId: "proposal.create",
      parsedData: leadResolution.parsedData,
    })
    return createCosAwaitingInputResult({
      response: "Para qual cliente devo gerar a proposta?",
      pendingInput: proposalPending,
    })
  }

  const propertyResolution = await resolvePropertyEntity({
    brokerId,
    message,
    payload: payloadRecord,
    pendingField: pendingInput?.field ?? null,
    pendingData: {
      ...pendingData,
      leadId: lead?.id ?? null,
      personName,
    },
    take: 4,
  })

  if ((propertyResolution.recordIds?.length ?? 0) > 1 && propertyResolution.options) {
    const proposalPending = createPendingInput({
      field: "propertyChoice",
      action: "CREATE_PROPOSAL",
      entity: "proposal",
      capabilityId: "proposal.create",
      parsedData: propertyResolution.parsedData,
      options: propertyResolution.options,
    })
    return createCosAwaitingInputResult({
      response: `Encontrei mais de um imóvel. Qual devo usar?\n\n${propertyResolution.options.map((option, index) => `${index + 1}. ${option.label}${option.description ? ` - ${option.description}` : ""}`).join("\n")}`,
      pendingInput: proposalPending,
    })
  }

  const resolvedProperty = propertyResolution.record
  if (!resolvedProperty) {
    const proposalPending = createPendingInput({
      field: "property",
      action: "CREATE_PROPOSAL",
      entity: "proposal",
      capabilityId: "proposal.create",
      parsedData: propertyResolution.parsedData,
    })
    return createCosAwaitingInputResult({
      response: "Qual imóvel devo usar na proposta?",
      pendingInput: proposalPending,
      leadId: lead?.id,
    })
  }

  const proposalLead = lead ?? {
    id: null,
    name: personName || "Cliente não informado",
    phone: null,
    email: null,
  }
  const title = `Proposta ${proposalLead.name ?? resolvedProperty.title ?? "EME"}`
  const proposalProperty = { ...resolvedProperty, imageUrl: firstImageUrl(resolvedProperty.imageUrls) }
  const document = await prisma.brokerDocument.create({
    data: {
      brokerId,
      leadId: lead?.id ?? null,
      propertyId: resolvedProperty.id,
      type: "proposal",
      title,
      content: buildProposalHtml({
        lead: proposalLead,
        property: proposalProperty,
        broker: {
          name: broker?.user.name ?? "",
          phone: broker?.phone,
          email: broker?.user.email,
          city: resolvedProperty.city,
          creci: broker?.creci,
          photoUrl: broker?.user.photoUrl,
        },
      }),
      status: "draft",
    },
  })

  await prisma.notification.create({
    data: {
      userId,
      title: "Proposta gerada",
      message: `Proposta para ${proposalLead.name || "cliente"} foi salva em Documentos.`,
      read: false,
    },
  })

  return createCosSuccessResult({
    response: `Proposta criada em rascunho.\nCliente: ${proposalLead.name || "Cliente"}\nImóvel: ${resolvedProperty.publicCode ?? resolvedProperty.id}\nRevise e preencha os dados restantes antes de enviar.`,
    metadata: {
      documentId: document.id,
      leadId: lead?.id ?? null,
      propertyId: resolvedProperty.id,
      status: "draft",
    },
    leadId: lead?.id ?? undefined,
    propertyId: resolvedProperty.id,
  })
}

export const proposalSummaryCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const proposals = await prisma.brokerDocument.findMany({
    where: { brokerId, type: "proposal" },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      status: true,
    },
  })

  const draftCount = proposals.filter((proposal) => proposal.status === "draft").length
  const pendingCount = proposals.filter((proposal) => proposal.status !== "draft").length

  return {
    response: proposals.length
      ? `Propostas atuais:\n\n- Total: ${proposals.length}\n- Em rascunho: ${draftCount}\n- Em andamento: ${pendingCount}\n\nÚltimas propostas:\n${proposals.slice(0, 3).map((proposal) => `- ${proposal.title}`).join("\n")}`
      : "Ainda não existem propostas registradas.",
    metadata: {
      totalProposals: proposals.length,
      draftProposals: draftCount,
      inProgressProposals: pendingCount,
      documentIds: proposals.map((proposal) => proposal.id),
    },
  }
}
