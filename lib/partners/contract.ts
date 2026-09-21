import { z } from "zod"

// Commercial planning only. Never used to grant access, charge or settle commissions.
export const TERMS_VERSION = "2026-09-21"
export const COMMISSION_PERCENT = 20
export const COMMISSION_MONTHS = 12
export const offers = ["PRO", "SCALE", "AGREEMENT", "TEAM"] as const
export const offerNames = {
  PRO: "Pro individual", SCALE: "Scale individual",
  AGREEMENT: "Corretor conveniado", TEAM: "Equipe patrocinada",
}
export const stages = ["NEW", "CONTACTED", "DEMO", "NEGOTIATING", "SUBMITTED", "WON_REPORTED", "LOST"] as const
export const stageNames = {
  NEW: "Registrada", CONTACTED: "Contato realizado", DEMO: "Demonstração",
  NEGOTIATING: "Em negociação", SUBMITTED: "Encaminhada ao EME",
  WON_REPORTED: "Adesão informada", LOST: "Encerrada",
}
export type Offer = typeof offers[number]
export type Stage = typeof stages[number]
const quantity = z.number().int().min(1).max(1000)
export const simulationSchema = z.object({ offer: z.enum(offers), seats: quantity }).strict()
  .refine(v => v.offer !== "TEAM" || v.seats >= 3, { message: "Equipes começam em 3 acessos.", path: ["seats"] })

export function simulate(input: { offer: Offer; seats: number }) {
  const { offer, seats } = simulationSchema.parse(input)
  const unitCents = offer === "SCALE" ? 38900 : offer === "PRO" ? 12900
    : offer === "AGREEMENT" ? 11900 : seats >= 10 ? 9900 : seats >= 5 ? 10900 : 11900
  const monthlyCents = unitCents * seats
  const commissionCents = Math.round(monthlyCents * COMMISSION_PERCENT / 100)
  const regularMonthlyCents = (offer === "AGREEMENT" ? 12900 : unitCents) * seats
  const regularCommissionCents = Math.round(regularMonthlyCents * COMMISSION_PERCENT / 100)
  // A team's price after month 6 has NOT been agreed. No invented annual promise.
  const periodMonths = offer === "TEAM" ? 6 : 12
  const periodCommissionCents = offer === "AGREEMENT"
    ? commissionCents * 3 + regularCommissionCents * 9 : commissionCents * periodMonths
  return { unitCents, monthlyCents, commissionCents, regularMonthlyCents, regularCommissionCents,
    periodMonths, periodCommissionCents, netBeforeCostsCents: monthlyCents - commissionCents }
}
export const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)

const text = (max: number) => z.string().trim().max(max)
const followUpAt = z.string().datetime({ offset: true }).nullable()
const details = {
  name: text(160).min(2, "Informe o nome do indicado."),
  email: text(254).email("Informe um e-mail válido.").transform(v => v.toLowerCase()),
  phone: text(30).regex(/^[\d\s()+.-]*$/, "Telefone inválido."),
  company: text(160), offer: z.enum(offers), seats: quantity,
  notes: text(3000), nextAction: text(240), followUpAt,
  doNotContact: z.boolean(),
}
const validTeam = (v: { offer: Offer; seats: number }) => v.offer !== "TEAM" || v.seats >= 3
export const createReferralSchema = z.object({
  ...details, operationKey: z.string().uuid(),
  contactPermission: z.literal(true, { errorMap: () => ({ message: "Confirme a autorização para registrar este contato." }) }),
}).strict().refine(validTeam, { message: "Equipes começam em 3 acessos.", path: ["seats"] })
  .refine(v => v.offer === "TEAM" || v.seats === 1, { message: "Registre uma pessoa por indicação individual.", path: ["seats"] })
export const updateReferralSchema = z.object({
  ...details, stage: z.enum(stages), activityNote: text(1200),
  expectedVersion: z.number().int().positive(), operationKey: z.string().uuid(),
}).strict().refine(validTeam, { message: "Equipes começam em 3 acessos.", path: ["seats"] })
  .refine(v => v.offer === "TEAM" || v.seats === 1, { message: "Registre uma pessoa por indicação individual.", path: ["seats"] })

export type Referral = {
  id: string; name: string; email: string; phone: string; company: string;
  offer: Offer; seats: number; stage: Stage; notes: string; nextAction: string;
  followUpAt: string | null; doNotContact: boolean; version: number; createdAt: string; updatedAt: string;
  activities: { id: string; action: string; note: string; createdAt: string }[];
}
export type ReferralList = {
  items: Referral[]; total: number; nextOffset: number | null;
  metrics: { registered: number; contacted: number; reported: number; open: number };
}
