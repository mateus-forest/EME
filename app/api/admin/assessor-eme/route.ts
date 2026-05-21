import { UserRole } from "@/lib/prisma-enums"

import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

function serializeConfig(config: {
  id: string
  officialNumber: string | null
  displayName: string | null
  status: string
  internalInstructions: string | null
  notes: string | null
  provider: string | null
  webhookStatus: string
  updatedAt: Date
} | null) {
  return {
    id: config?.id ?? null,
    officialNumber: config?.officialNumber ?? "",
    displayName: config?.displayName ?? "",
    status: config?.status ?? "IN_PREPARATION",
    internalInstructions: config?.internalInstructions ?? "",
    notes: config?.notes ?? "",
    provider: config?.provider ?? "",
    webhookStatus: config?.webhookStatus ?? "NOT_CONFIGURED",
    updatedAt: config?.updatedAt ? new Intl.DateTimeFormat("pt-BR").format(config.updatedAt) : "-",
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const config = await prisma.assessorEmeConfig.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json({ config: serializeConfig(config) })
  } catch (caughtError) {
    console.error("[api][admin][assessor-eme] load failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao carregar Assessor EME." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const current = await prisma.assessorEmeConfig.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
    })

    const data = {
      officialNumber: normalizeText(body?.officialNumber) ?? null,
      displayName: normalizeText(body?.displayName) ?? null,
      status: normalizeText(body?.status) || "IN_PREPARATION",
      internalInstructions: normalizeText(body?.internalInstructions) ?? null,
      notes: normalizeText(body?.notes) ?? null,
      provider: normalizeText(body?.provider) ?? null,
      webhookStatus: normalizeText(body?.webhookStatus) || "NOT_CONFIGURED",
    }

    const config = current
      ? await prisma.assessorEmeConfig.update({
          where: { id: current.id },
          data,
        })
      : await prisma.assessorEmeConfig.create({
          data,
        })

    return NextResponse.json({ config: serializeConfig(config) })
  } catch (caughtError) {
    console.error("[api][admin][assessor-eme] save failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao salvar Assessor EME." }, { status: 500 })
  }
}
