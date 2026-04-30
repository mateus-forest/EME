import { NextResponse } from "next/server"

import { getPublicBrokerCatalogBySlug } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const catalog = await getPublicBrokerCatalogBySlug(slug)

  if (!catalog) {
    return NextResponse.json({ error: "Catálogo não encontrado." }, { status: 404 })
  }

  return NextResponse.json({ catalog })
}
