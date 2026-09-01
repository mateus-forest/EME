import type { PrismaTransaction } from "@/lib/prisma"

export const OPEN_ENDED_RENTAL_SCHEDULE_MONTHS = 12

type RentalScheduleInput = {
  rentalId: string
  monthlyRent: number
  dueDay: number
  startDate: Date
  endDate: Date | null
}

export type RentalPaymentScheduleItem = {
  rentalId: string
  competence: string
  amount: number
  dueDate: Date
  status: "PENDING"
  notes: string
}

function utcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12))
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12))
}

function dueDateForMonth(month: Date, dueDay: number) {
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate()
  return new Date(Date.UTC(year, monthIndex, Math.min(dueDay, lastDay), 12))
}

function competenceForMonth(month: Date) {
  return `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`
}

export function buildRentalPaymentSchedule(input: RentalScheduleInput): RentalPaymentScheduleItem[] {
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) return []
  if (!Number.isInteger(input.monthlyRent) || input.monthlyRent <= 0) return []

  const firstMonth = utcMonth(input.startDate)
  const lastMonth = input.endDate
    ? utcMonth(input.endDate)
    : addUtcMonths(firstMonth, OPEN_ENDED_RENTAL_SCHEDULE_MONTHS - 1)

  if (lastMonth < firstMonth) return []

  const schedule: RentalPaymentScheduleItem[] = []
  for (let month = firstMonth; month <= lastMonth; month = addUtcMonths(month, 1)) {
    schedule.push({
      rentalId: input.rentalId,
      competence: competenceForMonth(month),
      amount: input.monthlyRent,
      dueDate: dueDateForMonth(month, input.dueDay),
      status: "PENDING",
      notes: "Previsão gerada automaticamente pela locação.",
    })
  }

  return schedule
}

export async function ensureRentalPaymentSchedule(
  prisma: Pick<PrismaTransaction, "rentalPayment">,
  input: RentalScheduleInput,
) {
  const schedule = buildRentalPaymentSchedule(input)
  if (schedule.length === 0) return { created: 0, expected: 0 }

  const result = await prisma.rentalPayment.createMany({
    data: schedule,
    skipDuplicates: true,
  })

  return { created: result.count, expected: schedule.length }
}
