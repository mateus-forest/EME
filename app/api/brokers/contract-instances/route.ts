import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  buildInstanceSnapshot,
  createTemplateContractContent,
  mergeKnownContractValues,
  parseTemplateStructure,
} from "@/lib/contract-template-server"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { response: error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return { response: forbidden }
  if (!user.broker) return { response: NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 }) }
  return { user }
}

const entitySelect = {
  broker: {
    include: { user: { select: { name: true, email: true, phone: true } }, agency: { select: { name: true } } },
  },
  lead: {
    select: { id: true, name: true, email: true, phone: true, whatsapp: true, legalData: true, addressData: true },
  },
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
}

function cleanId(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 100) : ""
}

export async function POST(request: NextRequest) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const brokerId = auth.user.broker!.id
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const templateId = cleanId(body?.templateId)
    const leadId = cleanId(body?.leadId) || null
    const propertyId = cleanId(body?.propertyId) || null
    if (!templateId) return NextResponse.json({ error: "Escolha um modelo." }, { status: 400 })

    const [template, broker, lead, property] = await Promise.all([
      prisma.contractTemplate.findFirst({
        where: { id: templateId, brokerId, status: "READY" },
        include: { versions: { orderBy: { version: "desc" } } },
      }),
      prisma.broker.findUnique({ where: { id: brokerId }, ...entitySelect.broker }),
      leadId ? prisma.lead.findFirst({ where: { id: leadId, brokerId }, select: entitySelect.lead.select }) : null,
      propertyId
        ? prisma.property.findFirst({ where: { id: propertyId, brokerId }, select: entitySelect.property.select })
        : null,
    ])
    if (!template) return NextResponse.json({ error: "Modelo pronto não encontrado." }, { status: 404 })
    if (!broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
    if (leadId && !lead) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })
    if (propertyId && !property) return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    const version = template.versions.find((item) => item.version === template.currentVersion)
    if (!version || version.status !== "READY") {
      return NextResponse.json({ error: "Revise e confirme este modelo antes de utilizá-lo." }, { status: 409 })
    }
    const structure = parseTemplateStructure(version.structure)
    const values = mergeKnownContractValues({
      structure,
      context: { lead, property, broker },
      refreshSources: ["CLIENT", "PROPERTY", "BROKER"],
    })
    const title = `${template.name} — ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`.slice(0, 180)
    const snapshot = buildInstanceSnapshot({ structure, values, title, draft: true })

    const instance = await prisma.$transaction(async (tx) => {
      const created = await tx.contractTemplateInstance.create({
        data: {
          workspaceId: `broker:${brokerId}`,
          brokerId,
          templateId: template.id,
          templateVersionId: version.id,
          leadId: lead?.id ?? null,
          propertyId: property?.id ?? null,
          title,
          status: "draft",
          values,
          additionalParties: {},
          readiness: snapshot.readiness.score,
        },
      })
      const document = await tx.brokerDocument.create({
        data: {
          brokerId,
          leadId: lead?.id ?? null,
          propertyId: property?.id ?? null,
          type: "contract",
          title,
          status: "draft",
          content: createTemplateContractContent({
            instanceId: created.id,
            title,
            status: "draft",
            html: snapshot.html,
            author: broker,
            lead,
            property,
          }),
        },
      })
      return tx.contractTemplateInstance.update({
        where: { id: created.id },
        data: { brokerDocumentId: document.id },
      })
    })

    return NextResponse.json({ instance: { id: instance.id, brokerDocumentId: instance.brokerDocumentId } }, { status: 201 })
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Contratos indisponíveis no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível criar o contrato com este modelo." }, { status: 500 })
  }
}
