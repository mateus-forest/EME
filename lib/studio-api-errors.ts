import { NextResponse } from "next/server"

export function studioUnavailableResponse() {
  return NextResponse.json(
    { error: "O Studio IA está temporariamente indisponível. Tente novamente em alguns instantes." },
    { status: 503 },
  )
}
