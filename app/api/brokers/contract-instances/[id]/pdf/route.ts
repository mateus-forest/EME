import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { calculateContractReadiness, renderContractTemplateHtml } from "@/lib/contract-template-engine"
import { generateContractPdf } from "@/lib/contract-pdf.server"
import { createTemplateContractContent, parseStoredTemplateStructure } from "@/lib/contract-template-server"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { recoverStoredContractTemplateVersion } from "@/lib/contract-template-recovery.server"

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
  const { id } = await context.params
  const draft = request.nextUrl.searchParams.get("draft") === "1"

  try {
    const instance = await prisma.contractTemplateInstance.findFirst({
      where: { id, brokerId: user.broker.id },
      include: {
        templateVersion: true,
        broker: { include: { user: { select: { name: true, email: true, phone: true } }, agency: { select: { name: true } } } },
        lead: { select: { id: true, name: true, email: true, phone: true, whatsapp: true, legalData: true, addressData: true } },
        property: { select: { id: true, publicCode: true, title: true, price: true, city: true, neighborhood: true, ownerName: true, legalData: true } },
      },
    })
    if (!instance) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })
    const recoveredVersion = await recoverStoredContractTemplateVersion(instance.templateVersion)
    const structure = parseStoredTemplateStructure(recoveredVersion.structure, recoveredVersion.originalText)
    const values = stringRecord(instance.values)
    const readiness = calculateContractReadiness(structure, values)
    if (!draft && readiness.score < 100) {
      return NextResponse.json(
        { error: `Complete as ${readiness.missing.length} informação(ões) obrigatória(s) antes de gerar o PDF final.` },
        { status: 409 },
      )
    }
    const pdf = await generateContractPdf({ title: instance.title, draft, structure, values })
    if (!draft && instance.status === "draft") {
      const html = renderContractTemplateHtml({
        structure,
        values,
        draft: false,
        title: instance.title,
      })
      const content = createTemplateContractContent({
        instanceId: instance.id,
        title: instance.title,
        status: "awaiting_signature",
        html,
        author: instance.broker,
        lead: instance.lead,
        property: instance.property,
        createdAt: instance.createdAt,
      })
      await prisma.$transaction([
        prisma.contractTemplateInstance.update({ where: { id: instance.id }, data: { status: "awaiting_signature" } }),
        ...(instance.brokerDocumentId ? [prisma.brokerDocument.update({
          where: { id: instance.brokerDocumentId },
          data: { status: "awaiting_signature", content },
        })] : []),
      ])
    }
    const safeName = instance.title.replace(/[^\p{L}\p{N}.-]+/gu, "-").replace(/-+/g, "-").slice(0, 120) || "contrato"
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}${draft ? "-rascunho" : ""}.pdf`)}`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error(`[contracts][instances] PDF generation failed (${id}): ${error instanceof Error ? `${error.name}: ${error.message}` : "unknown"}`)
    return NextResponse.json({ error: "Não foi possível gerar o PDF deste contrato." }, { status: 500 })
  }
}
