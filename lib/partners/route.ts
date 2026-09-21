import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { PartnerError } from "./service"

export async function partnerRoute(req: NextRequest, fn: (brokerId: string) => Promise<unknown>) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    const denied = ensureRole(user.role, ["BROKER"])
    if (denied) return denied
    if (!user.broker) throw new PartnerError("Corretor não encontrado.", 403)
    if (req.method !== "GET") {
      const origin = req.headers.get("origin")
      if ((origin && origin !== req.nextUrl.origin) || req.headers.get("sec-fetch-site") === "cross-site")
        throw new PartnerError("Origem não permitida.", 403)
    }
    return NextResponse.json(await fn(user.broker.id), { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Dados inválidos." }, { status: 400 })
    if (e instanceof PartnerError) return NextResponse.json({ error: e.message }, { status: e.status })
    // Never log contacts, notes, payloads or database connection strings.
    console.error("[partners] storage unavailable")
    return NextResponse.json({ error: "Indicações indisponíveis. Verifique a conexão e a migração de Parceiros EME neste ambiente." }, { status: 503 })
  }
}
export async function partnerBody(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new PartnerError("Envie JSON.")
  const text = await req.text()
  if (text.length > 16000) throw new PartnerError("Solicitação muito grande.", 413)
  try { return JSON.parse(text) as unknown } catch { throw new PartnerError("JSON inválido.") }
}
