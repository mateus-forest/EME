import { NextResponse } from "next/server"

import { getAdminCatalogsReport } from "@/lib/admin-catalogs"
import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    return NextResponse.json(await getAdminCatalogsReport())
  } catch (catalogError) {
    console.error("[admin][catalogs] failed", catalogError)
    return NextResponse.json({ error: "Não foi possível carregar os catálogos." }, { status: 500 })
  }
}
