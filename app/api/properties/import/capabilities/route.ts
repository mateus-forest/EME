import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { getOpenAIEnv } from "@/lib/env.server"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (forbidden) return forbidden

  const openAiEnv = getOpenAIEnv()
  const aiImportEnabled = Boolean(openAiEnv.enabled && openAiEnv.apiKey)

  return NextResponse.json({
    aiImportEnabled,
    aiImportReason: aiImportEnabled
      ? ""
      : "A importacao inteligente depende da configuracao da IA neste ambiente.",
  })
}
