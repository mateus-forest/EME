import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { generatePropertyCopy, propertyGenerationSchema } from "@/lib/property-ai"

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let stage = "auth"
  let payloadForLog: unknown = null
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const roleError = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (roleError) return roleError

  try {
    stage = "parse_payload"
    const payload = await request.json().catch(() => null)
    payloadForLog = payload
    console.info("[api][ai][generate-property][stage]", {
      stage,
      userId: user.id,
      role: user.role,
      hasPayload: Boolean(payload),
    })
    const input = propertyGenerationSchema.parse({
      title: payload?.title,
      type: payload?.type,
      city: payload?.city,
      neighborhood: payload?.neighborhood,
      price: payload?.price,
      bedrooms: payload?.bedrooms,
      bathrooms: payload?.bathrooms,
      parkingSpots: payload?.parkingSpots,
      description: payload?.description,
    })

    stage = "openai_generate"
    console.info("[api][ai][generate-property][stage]", {
      stage,
      userId: user.id,
      type: input.type,
      city: input.city,
      hasDescription: Boolean(input.description),
    })
    const result = await generatePropertyCopy(input)

    console.info("[api][ai][generate-property][success]", {
      stage: "completed",
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      resultKeys: Object.keys(result),
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error("[api][ai][generate-property][validation-failed]", {
        stage,
        userId: user.id,
        elapsedMs: Date.now() - startedAt,
        issues: error.issues,
        payload: payloadForLog,
      })
      return NextResponse.json({ error: "Payload inválido para geração de anúncio." }, { status: 400 })
    }

    console.error("[api][ai][generate-property] failed", {
      stage,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      payload: payloadForLog,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
    })

    const isOpenAIUnavailable =
      error instanceof Error && error.message.includes("OPENAI_DISABLED_OR_NOT_CONFIGURED")

    if (isOpenAIUnavailable) {
      return NextResponse.json(
        { error: "A integração de IA ainda não está habilitada neste ambiente." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Não foi possível gerar o anúncio com IA no momento." }, { status: 500 })
  }
}
