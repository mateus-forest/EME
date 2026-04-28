import { LeadStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { canAccessLead, leadInclude, parseLeadStatus, serializeLead } from "@/lib/lead-contract"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const status = parseLeadStatus(body?.status)

    if (!status) {
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
      data: { status },
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

    await prisma.lead.update({
      where: { id },
      data: {
        status: LeadStatus.ARCHIVED,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (caughtError) {
    console.error("[api][leads][id] archive failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de leads está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao arquivar lead." }, { status: 500 })
  }
}
