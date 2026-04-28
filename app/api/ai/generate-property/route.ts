import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { ZodError } from "zod"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { generatePropertyCopy, propertyGenerationSchema } from "@/lib/property-ai"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const roleError = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (roleError) return roleError

  try {
    const payload = await request.json().catch(() => null)
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

    const result = await generatePropertyCopy(input)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Payload inválido para geração de anúncio." }, { status: 400 })
    }

    console.error("[api][ai][generate-property] failed", {
      message: error instanceof Error ? error.message : "unknown",
    })

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("OPENAI_API_KEY")
            ? "A integração de IA não está configurada no servidor."
            : "Não foi possível gerar o anúncio com IA no momento.",
      },
      { status: 500 },
    )
  }
}
