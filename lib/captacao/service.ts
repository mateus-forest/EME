import "server-only"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma, type PrismaTransaction } from "@/lib/prisma"
import { getAuthEnv } from "@/lib/env.server"
import { extract, normalizeResponse, ProviderError, requestFor } from "./gecko"
import {
  domains,
  plain,
  safeUrl,
  stages,
  stageNames,
  type Filters,
  type Listing,
  type Source,
} from "./contract"

const include = {
  activities: { orderBy: { createdAt: "desc" as const }, take: 100 },
}
export class CaptacaoError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_INPUT",
  ) {
    super(message)
  }
}
export const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue
export const configured = () => Boolean(process.env.GECKO_API_KEY?.trim())
function signature(v: string) {
  return createHmac("sha256", getAuthEnv().secret)
    .update(`captacao:v1:${v}`)
    .digest()
}
export function receipt(listing: Listing, brokerId: string) {
  const clean = { ...listing }
  delete clean.receipt
  delete clean.possibleDuplicates
  const data = Buffer.from(
    JSON.stringify({
      listing: clean,
      brokerId,
      expires: Date.now() + 86_400_000,
    }),
  ).toString("base64url")
  return `${data}.${signature(data).toString("base64url")}`
}
export function readReceipt(token: unknown, brokerId: string): Listing {
  if (typeof token !== "string" || token.length > 24000)
    throw new CaptacaoError("Referência do anúncio inválida.")
  const [data, sig] = token.split(".")
  const expected = signature(data ?? "")
  const actual = Buffer.from(sig ?? "", "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new CaptacaoError("Referência do anúncio inválida.")
  let decoded
  try {
    decoded = JSON.parse(Buffer.from(data, "base64url").toString())
  } catch {
    throw new CaptacaoError("Referência inválida.")
  }
  if (decoded.brokerId !== brokerId || decoded.expires < Date.now())
    throw new CaptacaoError(
      "Consulta expirada ou pertencente a outro corretor. Consulte novamente.",
      403,
    )
  return decoded.listing as Listing
}
export async function runQuery(
  brokerId: string,
  source: Source,
  filters?: Filters,
  page = 1,
  listing?: Listing,
  fetcher = extract,
) {
  if (!configured())
    throw new ProviderError(
      "NOT_CONFIGURED",
      "Integração não configurada. A busca real requer a chave GeckoAPI no servidor.",
    )
  const body = filters
    ? requestFor(source, filters, page).body
    : {
        target: domains[source],
        type: "pdp",
        url: safeUrl(listing?.url, source),
      }
  if (!filters && !body.url)
    throw new CaptacaoError("URL de anúncio não permitida.")
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex")
  const reservation = await prisma.$transaction(async (tx) => {
    // Shared lock makes limits effective across processes and parallel requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(709142026)`
    const since = new Date(Date.now() - 3_600_000)
    const recent = await tx.captacaoQuery.findFirst({
      where: {
        brokerId,
        fingerprint,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
    })
    if (recent) {
      if (recent.response) return { cached: recent.response, id: recent.id }
      if (!recent.completedAt)
        throw new ProviderError(
          "QUERY_IN_PROGRESS",
          "Esta consulta já está em andamento. Aguarde a conclusão.",
          409,
        )
      throw new ProviderError(
        recent.errorCode ?? "SOURCE_UNAVAILABLE",
        "A consulta falhou recentemente. Aguarde um minuto antes de tentar novamente.",
      )
    }
    const own = await tx.captacaoQuery.count({
      where: { brokerId, createdAt: { gte: since } },
    })
    const total = await tx.captacaoQuery.count({
      where: { createdAt: { gte: since } },
    })
    if (own >= 20 || total >= 200)
      throw new ProviderError(
        "USAGE_LIMIT",
        "Limite de segurança de consultas atingido. Tente novamente mais tarde.",
        429,
      )
    const q = await tx.captacaoQuery.create({
      data: { brokerId, source, fingerprint },
    })
    return { id: q.id, cached: null }
  })
  let result: ReturnType<typeof normalizeResponse>
  if (reservation.cached)
    result = reservation.cached as unknown as typeof result
  else {
    try {
      const raw = await fetcher(body, process.env.GECKO_API_KEY!.trim())
      result = normalizeResponse(
        source,
        raw,
        new Date().toISOString(),
        filters,
        page,
      )
      if (listing && result.items[0]?.sourceId !== listing.sourceId)
        throw new ProviderError(
          "INVALID_RESPONSE",
          "A origem retornou outro anúncio; os dados anteriores foram preservados.",
        )
      if (listing)
        result.items = result.items.map((i) => ({
          ...i,
          matches: listing.matches,
        }))
      await prisma.captacaoQuery.update({
        where: { id: reservation.id },
        data: { response: json(result), completedAt: new Date() },
      })
      // Retain only usage metadata after the short-lived result cache expires.
      await prisma.captacaoQuery.updateMany({
        where: {
          brokerId,
          createdAt: { lt: new Date(Date.now() - 86_400_000) },
          response: { not: Prisma.DbNull },
        },
        data: { response: Prisma.DbNull },
      })
    } catch (e) {
      await prisma.captacaoQuery.update({
        where: { id: reservation.id },
        data: {
          errorCode: e instanceof ProviderError ? e.code : "SOURCE_UNAVAILABLE",
          completedAt: new Date(),
        },
      })
      throw e
    }
  }
  return {
    ...result,
    source,
    cached: Boolean(reservation.cached),
    items: result.items.map((i) => ({ ...i, receipt: receipt(i, brokerId) })),
  }
}
export async function listCaptures(brokerId: string, offset = 0) {
  const [items, total, groups, contacts] = await Promise.all([
    prisma.captacao.findMany({
      where: { brokerId },
      include,
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: 30,
    }),
    prisma.captacao.count({ where: { brokerId } }),
    prisma.captacao.groupBy({
      by: ["stage"],
      where: { brokerId },
      _count: { _all: true },
    }),
    prisma.captacaoActivity.count({
      where: { captacao: { brokerId }, action: "CONTACT" },
    }),
  ])
  return {
    items,
    total,
    nextOffset: offset + items.length < total ? offset + items.length : null,
    metrics: {
      saved: total,
      contacts,
      visits: groups.find((g) => g.stage === "VISIT")?._count._all ?? 0,
      confirmed: groups.find((g) => g.stage === "CONFIRMED")?._count._all ?? 0,
    },
  }
}
export async function getCapture(
  brokerId: string,
  id: string,
  tx: PrismaTransaction = prisma,
) {
  const capture = await tx.captacao.findFirst({
    where: { id, brokerId },
    include,
  })
  if (!capture) throw new CaptacaoError("Captação não encontrada.", 404)
  return capture
}
export async function saveCapture(brokerId: string, token: unknown) {
  const listing = readReceipt(token, brokerId)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`captacao-save:${brokerId}:${listing.key}`}))`
    return tx.captacao.upsert({
      where: { brokerId_sourceKey: { brokerId, sourceKey: listing.key } },
      update: {},
      create: {
        brokerId,
        sourceKey: listing.key,
        listing: json(listing),
        activities: {
          create: {
            operationKey: "saved",
            action: "SAVED",
            note: "Oportunidade salva. Disponibilidade e identidade ainda precisam de confirmação.",
          },
        },
      },
      include,
    })
  })
}
export const mutationSchema = z
  .object({
    operationKey: z.string().uuid(),
    action: z.enum([
      "note",
      "stage",
      "contact",
      "schedule",
      "privacy",
      "identity",
      "lead",
      "refresh",
    ]),
    note: z.string().trim().max(4000).optional(),
    stage: z.enum(stages).optional(),
    nextAction: z.string().trim().max(160).optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
    doNotContact: z.boolean().optional(),
    advertiserKind: z.enum(["owner", "broker", "agency", "unknown"]).optional(),
    leadId: z.string().max(120).nullable().optional(),
    receipt: z.string().max(24000).optional(),
  })
  .strict()
export async function mutateCapture(
  brokerId: string,
  id: string,
  raw: unknown,
) {
  const input = mutationSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`captacao:${brokerId}:${id}`}))`
    const current = await getCapture(brokerId, id, tx)
    if (
      await tx.captacaoActivity.findUnique({
        where: {
          captacaoId_operationKey: {
            captacaoId: id,
            operationKey: input.operationKey,
          },
        },
      })
    )
      return current
    const data: Prisma.CaptacaoUpdateInput = {}
    let action = input.action.toUpperCase()
    let note = plain(input.note, 4000)
    if (input.action === "contact") {
      if (current.doNotContact)
        throw new CaptacaoError(
          "Este anunciante não deseja contato. Registro de nova abordagem bloqueado.",
          409,
        )
      if (!note)
        throw new CaptacaoError("Descreva o contato efetivamente realizado.")
      if (current.stage === "SAVED") data.stage = "CONTACTED"
    } else if (input.action === "stage") {
      if (!input.stage || input.stage === "CONTACTED")
        throw new CaptacaoError(
          "Para marcar contato, use Registrar contato realizado.",
        )
      if (input.stage === "VISIT" && !current.agendaEventId)
        throw new CaptacaoError(
          "Agende a visita na Agenda antes de selecionar esta etapa.",
        )
      if (input.stage === "CONFIRMED" && note.length < 5)
        throw new CaptacaoError("Registre como a captação foi confirmada.")
      data.stage = input.stage
      note = `${stageNames[input.stage]}. ${note}`
    } else if (input.action === "note") {
      if (!note) throw new CaptacaoError("Escreva a observação.")
      data.notes = note
    } else if (input.action === "privacy") {
      if (input.doNotContact === undefined || !note)
        throw new CaptacaoError(
          "Informe a condição de contato e registre o motivo.",
        )
      data.doNotContact = input.doNotContact
      note = `${input.doNotContact ? "Não deseja contato" : "Restrição de contato removida por confirmação do corretor"}. ${note}`
    } else if (input.action === "identity") {
      if (!input.advertiserKind || note.length < 5)
        throw new CaptacaoError("Registre a evidência de identificação.")
      data.advertiserKind = input.advertiserKind
      data.identityEvidence = note
    } else if (input.action === "lead") {
      if (current.stage !== "CONFIRMED")
        throw new CaptacaoError(
          "Confirme a captação antes de associar um contato.",
        )
      if (
        !input.leadId ||
        !(await tx.lead.findFirst({ where: { id: input.leadId, brokerId } }))
      )
        throw new CaptacaoError("Selecione um contato deste corretor.")
      data.lead = { connect: { id: input.leadId } }
      note = "Contato existente associado conscientemente pelo corretor."
    } else if (input.action === "refresh") {
      const l = readReceipt(input.receipt, brokerId)
      if (l.key !== current.sourceKey)
        throw new CaptacaoError("A consulta pertence a outro anúncio.")
      data.listing = json(l)
      note =
        "Dados consultados na origem atualizados; notas e identificação do corretor preservadas."
    } else if (input.action === "schedule") {
      if (!input.dueAt || !input.nextAction)
        throw new CaptacaoError("Informe a próxima ação e a data de retorno.")
      const d = new Date(input.dueAt)
      if (d.getTime() < Date.now() - 60_000)
        throw new CaptacaoError("Escolha uma data futura.")
      if (current.doNotContact)
        throw new CaptacaoError(
          "Este anunciante não deseja contato. Revise a restrição antes de agendar uma abordagem.",
          409,
        )
      const isVisit = input.stage === "VISIT"
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d)
      const part = (t: string) => parts.find((p) => p.type === t)?.value
      const day = `${part("year")}-${part("month")}-${part("day")}`
      const eventData = {
        brokerId,
        title: plain(input.nextAction, 160),
        type: isVisit ? "visit" : "reminder",
        date: new Date(`${day}T00:00:00.000Z`),
        time: `${part("hour")}:${part("minute")}`,
        notes: `Captação: ${plain((current.listing as unknown as Listing).title, 240)}\n${plain((current.listing as unknown as Listing).url, 2048)}\n${note}`,
        status: "pending",
        leadId: current.leadId,
        propertyId: current.propertyId,
      }
      if (current.agendaEventId)
        await tx.agendaEvent.update({
          where: { id: current.agendaEventId, brokerId },
          data: eventData,
        })
      else {
        const event = await tx.agendaEvent.create({ data: eventData })
        data.agendaEvent = { connect: { id: event.id } }
      }
      data.nextAction = input.nextAction
      data.dueAt = d
      if (isVisit) data.stage = "VISIT"
      note = `${input.nextAction} — ${d.toISOString()}. Compromisso registrado na Agenda existente.`
    }
    if (input.action === "contact") action = "CONTACT"
    return tx.captacao.update({
      where: { id },
      data: {
        ...data,
        activities: {
          create: { operationKey: input.operationKey, action, note },
        },
      },
      include,
    })
  })
}
export async function inventoryCandidates(brokerId: string, id: string) {
  const c = await getCapture(brokerId, id)
  const l = c.listing as unknown as Listing
  const properties = await prisma.property.findMany({
    where: {
      brokerId,
      city: { equals: l.city, mode: "insensitive" },
      ...(l.neighborhood
        ? { neighborhood: { equals: l.neighborhood, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      title: true,
      price: true,
      city: true,
      neighborhood: true,
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  })
  return { capture: c, possibleDuplicates: properties }
}
export async function assertInventoryCapture(
  tx: PrismaTransaction,
  brokerId: string,
  id: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`captacao:${brokerId}:${id}`}))`
  const c = await getCapture(brokerId, id, tx)
  if (c.stage !== "CONFIRMED" || !c.leadId)
    throw new CaptacaoError(
      "Confirme a captação e associe um contato antes de adicionar à carteira.",
      409,
    )
  if (!(await tx.lead.findFirst({ where: { id: c.leadId, brokerId } })))
    throw new CaptacaoError(
      "Contato associado não está disponível para este corretor.",
      409,
    )
  return c
}
