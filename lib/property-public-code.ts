import type { Prisma, PrismaClient } from "@prisma/client"

type PrismaLike = PrismaClient | Prisma.TransactionClient

export async function getNextPropertyPublicCode(prismaClient: PrismaLike, brokerId: string) {
  const latest = await prismaClient.property.findFirst({
    where: { brokerId, publicCode: { not: null } },
    orderBy: { publicCode: "desc" },
    select: { publicCode: true },
  })

  return (latest?.publicCode ?? 0) + 1
}

export async function findPropertyByBrokerPublicCode(prismaClient: PrismaLike, brokerId: string, publicCode: number) {
  if (!Number.isInteger(publicCode) || publicCode <= 0) return null

  return prismaClient.property.findFirst({
    where: { brokerId, publicCode },
    select: {
      id: true,
      publicCode: true,
      title: true,
      city: true,
      neighborhood: true,
      description: true,
      price: true,
      purpose: true,
      type: true,
      bedrooms: true,
      parkingSpots: true,
      imageUrls: true,
    },
  })
}

export function extractPropertyPublicCode(message: string) {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const match = normalized.match(/\b(?:imovel|codigo|cod|id)\s*(?:n[ºo]\s*)?(\d{1,6})\b/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isInteger(value) && value > 0 ? value : null
}
