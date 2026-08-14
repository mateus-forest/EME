import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  buildInstanceSnapshot,
  createTemplateContractContent,
  mergeKnownContractValues,
  parseStoredTemplateStructure,
} from "@/lib/contract-template-server"
import { parseLeadAddress, parseLeadIdentification } from "@/lib/legal-entities"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { recoverStoredContractTemplateVersion } from "@/lib/contract-template-recovery.server"

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { response: error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return { response: forbidden }
  if (!user.broker) return { response: NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 }) }
  return { user }
}

const instanceInclude = {
  template: true,
  templateVersion: true,
  brokerDocument: true,
  broker: { include: { user: { select: { name: true, email: true, phone: true } }, agency: { select: { name: true } } } },
  lead: { select: { id: true, name: true, email: true, phone: true, whatsapp: true, legalData: true, addressData: true } },
  property: {
    select: {
      id: true,
      publicCode: true,
      title: true,
      price: true,
      city: true,
      neighborhood: true,
      ownerName: true,
      legalData: true,
    },
  },
} as const

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, item]) => [key.slice(0, 120), item.slice(0, 12_000)]),
  )
}

type AdditionalPartyState = Record<string, { leadId?: string; values?: Record<string, string> }>

function additionalPartiesRecord(value: unknown): AdditionalPartyState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const result: AdditionalPartyState = {}
  for (const [partyId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const source = raw as Record<string, unknown>
    result[partyId.slice(0, 120)] = {
      leadId: typeof source.leadId === "string" ? source.leadId.slice(0, 100) : undefined,
      values: stringRecord(source.values),
    }
  }
  return result
}

function addressLine(address: ReturnType<typeof parseLeadAddress>) {
  const street = [address.street, address.number].filter(Boolean).join(", ")
  return [street, address.complement, address.district, [address.city, address.state].filter(Boolean).join(" - ")]
    .filter(Boolean)
    .join(", ")
}

async function applyAdditionalPartyBindings(input: {
  brokerId: string
  structure: ReturnType<typeof parseStoredTemplateStructure>
  values: Record<string, string>
  additionalParties: AdditionalPartyState
}) {
  const leadIds = [...new Set(Object.values(input.additionalParties).map((party) => party.leadId).filter(Boolean))] as string[]
  const people = leadIds.length > 0
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds }, brokerId: input.brokerId },
        select: { id: true, name: true, email: true, phone: true, whatsapp: true, legalData: true, addressData: true },
      })
    : []
  const personById = new Map(people.map((person) => [person.id, person]))

  for (const field of input.structure.fields.filter((item) => item.source === "ADDITIONAL_PARTY" && item.partyId)) {
    const state = input.additionalParties[field.partyId!]
    const explicit = state?.values?.[field.id]
    if (typeof explicit === "string") {
      input.values[field.id] = explicit
      continue
    }
    const person = state?.leadId ? personById.get(state.leadId) : null
    if (!person) continue
    const identification = parseLeadIdentification(person.legalData)
    const address = parseLeadAddress(person.addressData)
    const byBinding: Record<string, string> = {
      "additionalParty.name": person.name ?? "",
      "additionalParty.email": person.email ?? "",
      "additionalParty.phone": person.whatsapp ?? person.phone ?? "",
      "additionalParty.cpfCnpj": identification.cpfCnpj,
      "additionalParty.rg": identification.rg,
      "additionalParty.nationality": identification.nationality,
      "additionalParty.profession": identification.profession,
      "additionalParty.maritalStatus": identification.maritalStatus,
      "additionalParty.address": addressLine(address),
    }
    input.values[field.id] = byBinding[field.binding] ?? input.values[field.id] ?? ""
  }
  return input.values
}

async function serializeInstance(instance: Awaited<ReturnType<typeof loadInstance>>) {
  if (!instance) return null
  const recoveredVersion = await recoverStoredContractTemplateVersion(instance.templateVersion, {
    templateTitle: instance.template.name,
  })
  const structure = parseStoredTemplateStructure(recoveredVersion.structure, recoveredVersion.originalText)
  const values = stringRecord(instance.values)
  const snapshot = buildInstanceSnapshot({ structure, values, title: instance.title, draft: instance.status === "draft" })
  return {
    id: instance.id,
    brokerDocumentId: instance.brokerDocumentId,
    title: instance.title,
    status: instance.status,
    template: { id: instance.template.id, name: instance.template.name, version: instance.templateVersion.version },
    leadId: instance.leadId,
    propertyId: instance.propertyId,
    values,
    additionalParties: instance.additionalParties,
    readiness: snapshot.readiness,
    html: snapshot.html,
    structure,
    signedAt: instance.signedAt?.toISOString() ?? null,
    signatureNote: instance.signatureNote,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  }
}

function loadInstance(id: string, brokerId: string) {
  return prisma.contractTemplateInstance.findFirst({ where: { id, brokerId }, include: instanceInclude })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const { id } = await context.params
  try {
    const instance = await loadInstance(id, auth.user.broker!.id)
    if (!instance) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })
    return NextResponse.json({ instance: await serializeInstance(instance) })
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Contrato indisponível no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível carregar o contrato." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const brokerId = auth.user.broker!.id
  const { id } = await context.params
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const current = await loadInstance(id, brokerId)
    if (!current) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })
    const leadId = body && "leadId" in body
      ? (typeof body.leadId === "string" && body.leadId ? body.leadId.slice(0, 100) : null)
      : current.leadId
    const propertyId = body && "propertyId" in body
      ? (typeof body.propertyId === "string" && body.propertyId ? body.propertyId.slice(0, 100) : null)
      : current.propertyId
    const [lead, property] = await Promise.all([
      leadId
        ? prisma.lead.findFirst({
            where: { id: leadId, brokerId },
            select: { id: true, name: true, email: true, phone: true, whatsapp: true, legalData: true, addressData: true },
          })
        : null,
      propertyId
        ? prisma.property.findFirst({
            where: { id: propertyId, brokerId },
            select: { id: true, publicCode: true, title: true, price: true, city: true, neighborhood: true, ownerName: true, legalData: true },
          })
        : null,
    ])
    if (leadId && !lead) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })
    if (propertyId && !property) return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })

    const recoveredVersion = await recoverStoredContractTemplateVersion(current.templateVersion, {
      templateTitle: current.template.name,
    })
    const structure = parseStoredTemplateStructure(recoveredVersion.structure, recoveredVersion.originalText)
    const incomingValues = body?.values ? stringRecord(body.values) : stringRecord(current.values)
    const refreshSources: Array<"CLIENT" | "PROPERTY" | "BROKER"> = []
    if (leadId !== current.leadId) refreshSources.push("CLIENT")
    if (propertyId !== current.propertyId) refreshSources.push("PROPERTY")
    const values = mergeKnownContractValues({
      structure,
      currentValues: incomingValues,
      context: { lead, property, broker: current.broker },
      refreshSources,
    })
    const additionalParties = body?.additionalParties
      ? additionalPartiesRecord(body.additionalParties)
      : additionalPartiesRecord(current.additionalParties)
    await applyAdditionalPartyBindings({ brokerId, structure, values, additionalParties })
    const title = typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 180)
      : current.title
    const snapshot = buildInstanceSnapshot({ structure, values, title, draft: current.status === "draft" })
    const content = createTemplateContractContent({
      instanceId: current.id,
      title,
      status: current.status,
      html: snapshot.html,
      author: current.broker,
      lead,
      property,
      createdAt: current.createdAt,
    })

    await prisma.$transaction([
      prisma.contractTemplateInstance.update({
        where: { id: current.id },
        data: {
          title,
          leadId: lead?.id ?? null,
          propertyId: property?.id ?? null,
          values,
          additionalParties,
          readiness: snapshot.readiness.score,
        },
      }),
      ...(current.brokerDocumentId ? [prisma.brokerDocument.update({
        where: { id: current.brokerDocumentId },
        data: { title, leadId: lead?.id ?? null, propertyId: property?.id ?? null, content },
      })] : []),
    ])

    const updated = await loadInstance(current.id, brokerId)
    return NextResponse.json({ instance: await serializeInstance(updated) })
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Contrato indisponível no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível salvar o contrato." }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const brokerId = auth.user.broker!.id
  const { id } = await context.params
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const action = typeof body?.action === "string" ? body.action : ""
    const current = await loadInstance(id, brokerId)
    if (!current) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })

    if (action === "sign") {
      const signedAt = typeof body?.signedAt === "string" ? new Date(body.signedAt) : new Date()
      if (Number.isNaN(signedAt.getTime())) return NextResponse.json({ error: "Informe uma data de assinatura válida." }, { status: 400 })
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : null
      const recoveredVersion = await recoverStoredContractTemplateVersion(current.templateVersion, {
        templateTitle: current.template.name,
      })
      const structure = parseStoredTemplateStructure(recoveredVersion.structure, recoveredVersion.originalText)
      const values = stringRecord(current.values)
      const snapshot = buildInstanceSnapshot({ structure, values, title: current.title, draft: false })
      if (snapshot.readiness.score < 100) {
        return NextResponse.json(
          { error: "Complete os campos obrigatórios antes de registrar a assinatura deste contrato." },
          { status: 409 },
        )
      }
      const content = createTemplateContractContent({
        instanceId: current.id,
        title: current.title,
        status: "signed",
        html: snapshot.html,
        author: current.broker,
        lead: current.lead,
        property: current.property,
        createdAt: current.createdAt,
      })
      await prisma.$transaction([
        prisma.contractTemplateInstance.update({
          where: { id: current.id },
          data: { status: "signed", signedAt, signatureNote: note },
        }),
        ...(current.brokerDocumentId ? [prisma.brokerDocument.update({
          where: { id: current.brokerDocumentId },
          data: { status: "signed", content },
        })] : []),
      ])
      return NextResponse.json({ instance: await serializeInstance(await loadInstance(current.id, brokerId)) })
    }

    if (action === "cancel") {
      if (current.status === "signed") {
        return NextResponse.json({ error: "Um contrato assinado não pode ser cancelado por este fluxo." }, { status: 409 })
      }
      const recoveredVersion = await recoverStoredContractTemplateVersion(current.templateVersion, {
        templateTitle: current.template.name,
      })
      const structure = parseStoredTemplateStructure(recoveredVersion.structure, recoveredVersion.originalText)
      const values = stringRecord(current.values)
      const snapshot = buildInstanceSnapshot({ structure, values, title: current.title, draft: false })
      const content = createTemplateContractContent({
        instanceId: current.id,
        title: current.title,
        status: "cancelled",
        html: snapshot.html,
        author: current.broker,
        lead: current.lead,
        property: current.property,
        createdAt: current.createdAt,
      })
      await prisma.$transaction([
        prisma.contractTemplateInstance.update({
          where: { id: current.id },
          data: { status: "cancelled", signedAt: null, signatureNote: null },
        }),
        ...(current.brokerDocumentId ? [prisma.brokerDocument.update({
          where: { id: current.brokerDocumentId },
          data: { status: "cancelled", content },
        })] : []),
      ])
      return NextResponse.json({ instance: await serializeInstance(await loadInstance(current.id, brokerId)) })
    }

    if (action === "duplicate") {
      const recoveredVersion = await recoverStoredContractTemplateVersion(current.templateVersion, {
        templateTitle: current.template.name,
      })
      const structure = parseStoredTemplateStructure(recoveredVersion.structure, recoveredVersion.originalText)
      const values = stringRecord(current.values)
      const title = `${current.title} — cópia`.slice(0, 180)
      const snapshot = buildInstanceSnapshot({ structure, values, title, draft: true })
      const duplicated = await prisma.$transaction(async (tx) => {
        const instance = await tx.contractTemplateInstance.create({
          data: {
            workspaceId: current.workspaceId,
            brokerId,
            templateId: current.templateId,
            templateVersionId: current.templateVersionId,
            leadId: current.leadId,
            propertyId: current.propertyId,
            title,
            status: "draft",
            values,
            additionalParties: additionalPartiesRecord(current.additionalParties),
            readiness: snapshot.readiness.score,
          },
        })
        const document = await tx.brokerDocument.create({
          data: {
            brokerId,
            leadId: current.leadId,
            propertyId: current.propertyId,
            type: "contract",
            title,
            status: "draft",
            content: createTemplateContractContent({
              instanceId: instance.id,
              title,
              status: "draft",
              html: snapshot.html,
              author: current.broker,
              lead: current.lead,
              property: current.property,
            }),
          },
        })
        return tx.contractTemplateInstance.update({ where: { id: instance.id }, data: { brokerDocumentId: document.id } })
      })
      return NextResponse.json({ instance: { id: duplicated.id, brokerDocumentId: duplicated.brokerDocumentId } }, { status: 201 })
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Contrato indisponível no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível concluir esta ação." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const brokerId = auth.user.broker!.id
  const { id } = await context.params
  try {
    const current = await loadInstance(id, brokerId)
    if (!current) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      await tx.contractTemplateInstance.delete({ where: { id: current.id } })
      if (current.brokerDocumentId) {
        await tx.brokerDocument.deleteMany({ where: { id: current.brokerDocumentId, brokerId } })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[contracts][instances] deletion failed", {
      instanceId: id,
      brokerId,
      message: error instanceof Error ? error.message : "unknown",
    })
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Contrato indisponível no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível excluir o contrato." }, { status: 500 })
  }
}
