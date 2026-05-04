import { NextResponse } from "next/server"

import { createAuthToken, setAuthCookie } from "@/lib/auth"
import { getAuthenticatedUser } from "@/lib/auth-route"
import { buildSessionProfile } from "@/lib/session-profile"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const response = NextResponse.json({ user: buildSessionProfile(user) })
  response.headers.set("Cache-Control", "no-store, max-age=0")

  const token = await createAuthToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  setAuthCookie(response, token)

  return response
}
