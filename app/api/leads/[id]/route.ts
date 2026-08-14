import { NextRequest, NextResponse } from "next/server"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { normalizeEntityDocumentForStorage } from "@/lib/entity-document"
import { canAccessLead, leadInclude, parseLeadStatus, serializeLead } from "@/lib/lead-contract"
import { parseEntityDocuments } from "@/lib/legal-entities"
import { prisma } from "@/lib/prisma"
import { normalizeCep, normalizeCpfCnpj, normalizePhone, parseBrazilianDateToIso } from "@/lib/structured-fields"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const status = body?.status === undefined ? null : parseLeadStatus(body?.status)

    if (body?.status !== undefined && !status) {
      return NextResponse.json({ error: "Status do lead inválido." }, { status: 400 })
    }

    const currentLead = await prisma.lead.findUnique({
      where: { id },
      select: {
        brokerId: true,
        agencyId: true,
      },
    })

    if (!currentLead) {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 })
    }

    if (!canAccessLead(user, currentLead)) {
      return NextResponse.json({ error: "Acesso não permitido para este lead." }, { status: 403 })
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(typeof body?.name === "string" ? { name: cleanText(body.name, 120) || null } : {}),
        ...(typeof body?.email === "string" ? { email: cleanText(body.email, 160).toLowerCase() || null } : {}),
        ...(typeof body?.phone === "string" ? { phone: normalizePhone(body.phone) || null } : {}),
        ...(typeof body?.whatsApp === "string" ? { whatsapp: normalizePhone(body.whatsApp) || null } : {}),
        ...(typeof body?.message === "string" ? { message: cleanText(body.message, 1200) || null } : {}),
        ...(typeof body?.searchTerm === "string" ? { searchTerm: cleanText(body.searchTerm, 240) || null } : {}),
        ...(typeof body?.intent === "string" ? { intent: cleanText(body.intent, 120) || null } : {}),
        ...(body?.identification || body?.legal
          ? {
              legalData: {
                ...normalizeLeadIdentification(body?.identification),
                ...normalizeLeadLegal(body?.legal),
              },
            }
          : {}),
        ...(body?.address ? { addressData: normalizeLeadAddress(body.address) } : {}),
        ...(body?.documents ? { documentsData: normalizeDocuments(body.documents) } : {}),
        ...(typeof body?.propertyId === "string" ? { propertyId: cleanText(body.propertyId, 120) || null } : {}),
      },
      include: leadInclude,
    })

    return NextResponse.json({ lead: serializeLead(lead) })
  } catch (caughtError) {
    console.error("[api][leads][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de leads está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Clientes / atualizacao de lead")
    }

    return NextResponse.json({ error: "Erro interno ao atualizar lead." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const { id } = await params
    const currentLead = await prisma.lead.findUnique({
      where: { id },
      select: {
        brokerId: true,
        agencyId: true,
      },
    })

    if (!currentLead) {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 })
    }

    if (!canAccessLead(user, currentLead)) {
      return NextResponse.json({ error: "Acesso não permitido para este lead." }, { status: 403 })
    }

    await prisma.lead.delete({
      where: { id },
    })

    return NextResponse.json({ deleted: true, id })
  } catch (caughtError) {
    console.error("[api][leads][id] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de leads está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Clientes / exclusao de lead")
    }

    return NextResponse.json({ error: "Erro interno ao excluir lead." }, { status: 500 })
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

function normalizeLeadIdentification(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return {
    cpfCnpj: normalizeCpfCnpj(source.cpfCnpj),
    rg: cleanText(source.rg, 32),
    issuingAuthority: cleanText(source.issuingAuthority, 64),
    issueDate: parseBrazilianDateToIso(source.issueDate) ?? cleanText(source.issueDate, 32),
    nationality: cleanText(source.nationality, 64),
    birthPlace: cleanText(source.birthPlace, 64),
    maritalStatus: cleanText(source.maritalStatus, 64),
    propertyRegime: cleanText(source.propertyRegime, 64),
    profession: cleanText(source.profession, 96),
  }
}

function normalizeLeadAddress(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return {
    cep: normalizeCep(source.cep),
    street: cleanText(source.street, 160),
    number: cleanText(source.number, 24),
    complement: cleanText(source.complement, 120),
    district: cleanText(source.district, 120),
    city: cleanText(source.city, 120),
    state: cleanText(source.state, 32),
  }
}

function normalizeLeadLegal(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return {
    legalRepresentative: cleanText(source.legalRepresentative, 160),
    powerOfAttorney: cleanText(source.powerOfAttorney, 160),
    legalNotes: cleanText(source.legalNotes, 1200),
  }
}

function normalizeDocuments(value: unknown) {
  return parseEntityDocuments(value).map((document) => normalizeEntityDocumentForStorage(document, cleanText))
}
