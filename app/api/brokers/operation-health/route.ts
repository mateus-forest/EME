import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { formatCurrencyBRLFromCents } from "@/lib/currency"
import {
  computeLeadCompletion,
  computePropertyCompletion,
  parseEntityDocuments,
  parseLeadAddress,
  parseLeadIdentification,
  parsePropertyLegalData,
} from "@/lib/legal-entities"
import { isEmeActivePropertyStatus } from "@/lib/eme-plans"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const DOCUMENT_TYPES_HIDDEN_FROM_OPERATION = [
  "studio_ia_video_job",
  "studio_ia_video_lock",
  "cos_conversation",
]

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}

function averageScore(scores: number[]) {
  if (scores.length === 0) return 100
  return clampScore(Math.round(scores.reduce((total, score) => total + score, 0) / scores.length))
}

function healthyRatio(total: number, unhealthy: number) {
  if (total === 0) return 100
  return clampScore(Math.round(((total - unhealthy) / total) * 100))
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  const brokerId = user.broker.id
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1)

  try {
    const [properties, leads, documentGroups, agendaTotal, overdueAgenda, pendingAgenda] = await Promise.all([
      prisma.property.findMany({
        where: { brokerId },
        select: {
          title: true,
          ownerName: true,
          price: true,
          status: true,
          legalData: true,
          documentsData: true,
        },
      }),
      prisma.lead.findMany({
        where: { brokerId },
        select: {
          name: true,
          email: true,
          phone: true,
          whatsapp: true,
          status: true,
          legalData: true,
          addressData: true,
        },
      }),
      prisma.brokerDocument.groupBy({
        by: ["type", "status"],
        where: { brokerId, type: { notIn: DOCUMENT_TYPES_HIDDEN_FROM_OPERATION } },
        _count: { _all: true },
      }),
      prisma.agendaEvent.count({ where: { brokerId } }),
      prisma.agendaEvent.count({ where: { brokerId, status: "pending", date: { lt: todayStart } } }),
      prisma.agendaEvent.count({ where: { brokerId, status: "pending", date: { lt: tomorrowStart } } }),
    ])

    const propertyScores = properties.map((property) =>
      computePropertyCompletion({
        title: property.title,
        ownerName: property.ownerName ?? "",
        price: formatCurrencyBRLFromCents(property.price),
        legal: parsePropertyLegalData(property.legalData),
      }).score,
    )
    const leadDetails = leads.map((lead) => {
      const identification = parseLeadIdentification(lead.legalData)
      const address = parseLeadAddress(lead.addressData)
      return {
        identification,
        address,
        score: computeLeadCompletion({
          name: lead.name ?? "",
          email: lead.email ?? "",
          phone: lead.whatsapp ?? lead.phone ?? "",
          identification,
          address,
        }).score,
      }
    })

    const documentTotal = documentGroups.reduce((total, group) => total + group._count._all, 0)
    const draftDocuments = documentGroups
      .filter((group) => group.status === "draft")
      .reduce((total, group) => total + group._count._all, 0)
    const contractGroups = documentGroups.filter((group) => group.type === "contract")
    const contractTotal = contractGroups.reduce((total, group) => total + group._count._all, 0)
    const cancelledContracts = contractGroups
      .filter((group) => group.status === "cancelled")
      .reduce((total, group) => total + group._count._all, 0)
    const draftContracts = contractGroups
      .filter((group) => group.status === "draft")
      .reduce((total, group) => total + group._count._all, 0)
    const awaitingSignature = contractGroups
      .filter((group) => group.status === "awaiting_signature" || group.status === "generated")
      .reduce((total, group) => total + group._count._all, 0)
    const unattendedLeads = leads.filter((lead) => lead.status === "NEW").length

    const scores = {
      clients: averageScore(leadDetails.map((lead) => lead.score)),
      properties: averageScore(propertyScores),
      documents: healthyRatio(documentTotal, draftDocuments),
      contracts: healthyRatio(contractTotal, cancelledContracts),
      agenda: agendaTotal === 0 ? 100 : clampScore(100 - overdueAgenda * 12),
      leads: healthyRatio(leads.length, unattendedLeads),
    }

    const response = NextResponse.json({
      score: averageScore(Object.values(scores)),
      scores,
      activePropertiesCount: properties.filter((property) => isEmeActivePropertyStatus(property.status)).length,
      pending: {
        missingRegistry: properties.filter((property) => !parsePropertyLegalData(property.legalData).registryNumber).length,
        missingPropertyDocuments: properties.filter((property) => parseEntityDocuments(property.documentsData).length === 0).length,
        missingRg: leadDetails.filter((lead) => !lead.identification.rg).length,
        missingLeadInformation: leadDetails.filter(
          (lead) => !lead.identification.rg || !lead.identification.cpfCnpj || !lead.address.city,
        ).length,
        unattendedLeads,
        awaitingSignature,
        draftDocuments,
        draftContracts,
        pendingAgenda,
      },
    })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][brokers][operation-health] calculation failed", {
      brokerId,
      unavailable: isPrismaUnavailable(caughtError),
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    return NextResponse.json(
      { error: "Não foi possível calcular a saúde da operação." },
      { status: isPrismaUnavailable(caughtError) ? 503 : 500 },
    )
  }
}
