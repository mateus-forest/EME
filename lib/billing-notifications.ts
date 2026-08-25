import {
  buildBillingNotificationId,
  type BillingNotificationKind,
} from "@/lib/billing-lifecycle-policy"
import { prisma } from "@/lib/prisma"

export function formatBillingNotificationDate(value: Date | number | null) {
  if (value === null) return null
  const date = typeof value === "number" ? new Date(value * 1_000) : value
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function formatBillingNotificationCurrency(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueCents / 100)
}

export async function createBillingNotification(input: {
  userId: string
  kind: BillingNotificationKind
  sourceId: string
  title: string
  message: string
}) {
  const id = buildBillingNotificationId(input.kind, input.sourceId)
  return prisma.notification.upsert({
    where: { id },
    update: {},
    create: {
      id,
      userId: input.userId,
      title: input.title,
      message: input.message,
      read: false,
    },
  })
}
