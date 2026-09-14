import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { CaptacaoError } from "./service"
import { ProviderError } from "./gecko"
export async function captacaoRoute(
  req: NextRequest,
  fn: (brokerId: string) => Promise<unknown>,
) {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user)
    return (
      error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    )
  const denied = ensureRole(user.role, ["BROKER"])
  if (denied) return denied
  if (!user.broker)
    return NextResponse.json(
      { error: "Corretor não encontrado." },
      { status: 403 },
    )
  if (req.method !== "GET") {
    const origin = req.headers.get("origin")
    if (origin && origin !== req.nextUrl.origin)
      return NextResponse.json(
        { error: "Origem não permitida." },
        { status: 403 },
      )
  }
  try {
    return NextResponse.json(await fn(user.broker.id), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: e.issues[0]?.message || "Dados inválidos.",
          code: "INVALID_INPUT",
        },
        { status: 400 },
      )
    if (e instanceof CaptacaoError || e instanceof ProviderError)
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      )
    console.error("[captacao] operation failed", {
      code:
        typeof e === "object" && e && "code" in e
          ? String(e.code)
          : "UNEXPECTED",
    })
    return NextResponse.json(
      {
        error:
          "Captação indisponível. Verifique a configuração e a migração deste ambiente.",
        code: "STORAGE_UNAVAILABLE",
      },
      { status: 503 },
    )
  }
}
export async function body(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new CaptacaoError("Envie JSON.")
  const raw = await req.text()
  if (raw.length > 32000)
    throw new CaptacaoError("Solicitação muito grande.", 413)
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new CaptacaoError("JSON inválido.")
  }
}
