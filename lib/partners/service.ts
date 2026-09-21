import "server-only"
import { prisma } from "@/lib/prisma"
import { createReferralSchema, updateReferralSchema, stageNames, TERMS_VERSION } from "./contract"

export class PartnerError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
const activities = { orderBy: { createdAt: "desc" as const }, take: 30 }

export async function listReferrals(brokerId: string, offset: number) {
  return prisma.$transaction(async tx => {
    const where = { brokerId }
    const [items, total, grouped, contacted] = await Promise.all([
      tx.partnerReferral.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: offset, take: 20, include: { activities } }),
      tx.partnerReferral.count({ where }),
      tx.partnerReferral.groupBy({ by: ["stage"], where, _count: true }),
      tx.partnerReferral.count({ where: { brokerId, activities: { some: { action: "CONTACTED" } } } }),
    ])
    const count = (stage: string) => grouped.find(g => g.stage === stage)?._count ?? 0
    return { items, total, nextOffset: offset + items.length < total ? offset + items.length : null,
      metrics: { registered: total, contacted, reported: count("WON_REPORTED"), open: total - count("LOST") - count("WON_REPORTED") } }
  }, { isolationLevel: "RepeatableRead" })
}

export async function createReferral(brokerId: string, raw: unknown) {
  const { contactPermission: _permission, operationKey, ...data } = createReferralSchema.parse(raw)
  void _permission
  try {
    return await prisma.partnerReferral.create({ data: {
      ...data, brokerId, operationKey, termsVersion: TERMS_VERSION,
      followUpAt: data.followUpAt ? new Date(data.followUpAt) : null,
      activities: { create: { operationKey, action: "NEW", note: "Indicação registrada com autorização de contato informada pelo parceiro." } },
    }, include: { activities } })
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      const existing = await prisma.partnerReferral.findUnique({ where: { brokerId_operationKey: { brokerId, operationKey } }, include: { activities } })
      if (existing) return existing
      throw new PartnerError("Você já registrou uma indicação com este e-mail. Abra o registro existente.", 409)
    }
    throw e
  }
}

export async function updateReferral(brokerId: string, id: string, raw: unknown) {
  const { operationKey, expectedVersion, activityNote, ...data } = updateReferralSchema.parse(raw)
  try {
    return await prisma.$transaction(async tx => {
      const current = await tx.partnerReferral.findFirst({ where: { id, brokerId } })
      if (!current) throw new PartnerError("Indicação não encontrada.", 404)
      const already = await tx.partnerReferralActivity.findUnique({ where: { referralId_operationKey: { referralId: id, operationKey } } })
      if (already) return tx.partnerReferral.findUniqueOrThrow({ where: { id }, include: { activities } })
      if (data.stage === "CONTACTED" && current.stage !== data.stage && (current.doNotContact || data.doNotContact))
        throw new PartnerError("Este contato não deseja abordagem. Revise a preferência antes de registrar novo contato.")
      const changed = await tx.partnerReferral.updateMany({ where: { id, brokerId, version: expectedVersion }, data: {
        ...data, followUpAt: data.followUpAt ? new Date(data.followUpAt) : null, version: { increment: 1 },
      } })
      if (!changed.count) throw new PartnerError("Esta indicação foi atualizada em outra sessão. Feche e recarregue a lista antes de editar.", 409)
      const preferenceChanged = current.doNotContact !== data.doNotContact
      const summary = [current.stage !== data.stage ? `Etapa: ${stageNames[data.stage]}.` : "Dados atualizados.",
        preferenceChanged ? (data.doNotContact ? "Não deseja contato." : "Preferência de não contato removida pelo parceiro.") : "",
        activityNote].filter(Boolean).join(" ")
      await tx.partnerReferralActivity.create({ data: { referralId: id, operationKey,
        action: current.stage !== data.stage ? data.stage : "UPDATED", note: summary } })
      return tx.partnerReferral.findUniqueOrThrow({ where: { id }, include: { activities } })
    })
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002")
      throw new PartnerError("Registro duplicado. Recarregue a lista antes de tentar novamente.", 409)
    throw e
  }
}
