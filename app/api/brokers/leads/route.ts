import { UserRole } from "@/lib/prisma-enums"

import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { leadInclude, serializeLead } from "@/lib/lead-contract"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: {
        brokerId: user.broker.id,
      },
      include: leadInclude,
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ leads: leads.map(serializeLead) })
  } catch (caughtError) {
    console.error("[api][brokers][leads] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de leads esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: leadListErrorMessage(caughtError) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => null)
    const propertyId = cleanText(body?.propertyId, 120)
    const name = cleanText(body?.name, 120)
    const email = cleanText(body?.email, 160).toLowerCase()
    const phone = cleanText(body?.phone, 40)
    const message = cleanText(body?.message, 800)
    const searchTerm = cleanText(body?.searchTerm, 240)
    const intent = cleanText(body?.intent, 120)

    if (!name && !email && !phone) {
      return NextResponse.json(
        { error: "Informe pelo menos nome, telefone ou email para cadastrar o cliente." },
        { status: 400 },
      )
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Informe um email valido." }, { status: 400 })
    }

    const property = propertyId
      ? await prisma.property.findFirst({
          where: {
            id: propertyId,
            brokerId: user.broker.id,
          },
          select: {
            id: true,
            title: true,
          },
        })
      : null

    if (propertyId && !property) {
      return NextResponse.json({ error: "Imovel nao encontrado para este corretor." }, { status: 404 })
    }

    const existingLead =
      phone || email
        ? await prisma.lead.findFirst({
            where: {
              brokerId: user.broker.id,
              OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
            },
            orderBy: { updatedAt: "desc" },
            include: leadInclude,
          })
        : null

    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            name: name || existingLead.name,
            email: email || existingLead.email,
            phone: phone || existingLead.phone,
            message: message || existingLead.message || null,
            searchTerm: searchTerm || existingLead.searchTerm || null,
            intent: intent || existingLead.intent || null,
            propertyId: property?.id ?? existingLead.propertyId ?? null,
            source: "manual",
            userId: user.id,
            agencyId: user.broker.agencyId ?? existingLead.agencyId ?? null,
          },
          include: leadInclude,
        })
      : await prisma.lead.create({
          data: {
            name: name || null,
            email: email || null,
            phone: phone || null,
            message: message || (property ? `Cliente vinculado ao imovel ${property.title}` : null),
            searchTerm: searchTerm || null,
            intent: intent || null,
            source: "manual",
            propertyId: property?.id ?? null,
            brokerId: user.broker.id,
            agencyId: user.broker.agencyId ?? null,
            userId: user.id,
          },
          include: leadInclude,
        })

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: existingLead ? "Cliente atualizado" : "Cliente cadastrado",
        message: existingLead
          ? `${lead.name || lead.phone || lead.email || "Cliente"} foi atualizado no CRM.`
          : `${lead.name || lead.phone || lead.email || "Cliente"} foi cadastrado no CRM.`,
        read: false,
      },
    })

    return NextResponse.json(
      {
        lead: serializeLead(lead),
        created: !existingLead,
      },
      { status: existingLead ? 200 : 201 },
    )
  } catch (caughtError) {
    console.error("[api][brokers][leads] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de leads esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: leadCreateErrorMessage(caughtError) }, { status: 500 })
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

function leadListErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  const missingColumn = message.match(/column [`"]?([\w.]+)[`"]?/i)?.[1]

  if (missingColumn) {
    return `Nao foi possivel listar leads. Coluna necessaria ausente no banco: ${missingColumn}.`
  }

  return "Nao foi possivel listar os leads do corretor agora."
}

function leadCreateErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  const missingColumn = message.match(/column [`"]?([\w.]+)[`"]?/i)?.[1]

  if (missingColumn) {
    return `Nao foi possivel cadastrar o cliente. Coluna necessaria ausente no banco: ${missingColumn}.`
  }

  return "Nao foi possivel cadastrar o cliente agora. Revise os dados e tente novamente."
}
