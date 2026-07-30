import { inferAssessorAction, type PendingAssessorContext } from "@/lib/eme-backend"

import { getCosCapabilityByAction } from "@/lib/cos/capability-registry"
import {
  getCosCapabilityDescriptorByAliasOrAction,
  getCosEntityModuleIdByCapabilityId,
  listCosCapabilityCatalog,
} from "@/lib/cos/capability-catalog"
import type {
  CosCapabilityDescriptor,
  CosCapabilityPlan,
  CosCapabilityPlanSource,
  CosCapabilitySurface,
  CosEntityModuleId,
} from "@/lib/cos/types"

const GENERIC_TOKENS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "esta",
  "este",
  "isso",
  "me",
  "meu",
  "minha",
  "na",
  "nas",
  "no",
  "nos",
  "mostrar",
  "mostre",
  "listar",
  "lista",
  "quais",
  "quanto",
  "o",
  "os",
  "ou",
  "pendente",
  "pendentes",
  "para",
  "por",
  "pra",
  "que",
  "se",
  "tem",
  "tenho",
  "um",
  "uma",
])

const STRONG_VERBS = {
  create: ["criar", "gere", "gerar", "cadastrar", "cadastre", "novo", "nova"],
  list: ["listar", "lista", "mostrar", "mostre", "quais", "ver"],
  update: ["atualizar", "atualize", "melhorar", "melhore", "revisar", "revise"],
  complete: ["concluir", "conclua", "marcar", "marque", "feito", "finalizar"],
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !GENERIC_TOKENS.has(token))
}

function getEntityModuleId(descriptor: CosCapabilityDescriptor): CosEntityModuleId {
  return getCosEntityModuleIdByCapabilityId(descriptor.id) ?? "general"
}

function buildCapabilitySearchDocument(descriptor: CosCapabilityDescriptor) {
  const actionTokens = descriptor.action
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")

  return [
    descriptor.title,
    descriptor.description,
    descriptor.domain,
    descriptor.entity,
    descriptor.id,
    actionTokens,
    descriptor.aliases.join(" "),
    getEntityModuleId(descriptor),
  ].join(" ")
}

function inferVerbHint(normalizedMessage: string) {
  if (STRONG_VERBS.create.some((token) => normalizedMessage.includes(token))) return "create"
  if (STRONG_VERBS.complete.some((token) => normalizedMessage.includes(token))) return "complete"
  if (STRONG_VERBS.update.some((token) => normalizedMessage.includes(token))) return "update"
  if (STRONG_VERBS.list.some((token) => normalizedMessage.includes(token))) return "list"
  return null
}

function tokensMatch(left: string, right: string) {
  if (left === right) return true
  if (left.length >= 4 && right.length >= 4 && (left.startsWith(right.slice(0, 4)) || right.startsWith(left.slice(0, 4)))) return true
  if (left.endsWith("s") && left.slice(0, -1) === right) return true
  if (right.endsWith("s") && right.slice(0, -1) === left) return true
  return false
}

function scoreCapability(descriptor: CosCapabilityDescriptor, message: string, requestedAction: string | undefined, surface: CosCapabilitySurface) {
  if (!descriptor.surfaces.includes(surface)) return null

  const normalizedMessage = normalizeText(message)
  const messageTokens = tokenize(message)
  const searchTokens = new Set(tokenize(buildCapabilitySearchDocument(descriptor)))
  const requestedMatch = requestedAction ? getCosCapabilityDescriptorByAliasOrAction(requestedAction) : null

  let score = 0
  const reasons: string[] = []

  if (requestedMatch?.id === descriptor.id) {
    score += 8
    reasons.push(`requestedAction=${requestedAction}`)
  }

  if (descriptor.aliases.some((alias) => normalizeText(alias) === normalizedMessage)) {
    score += 6
    reasons.push("alias exato")
  }

  const matchedAlias = descriptor.aliases.find((alias) => normalizedMessage.includes(normalizeText(alias)))
  if (matchedAlias) {
    score += 3.5
    reasons.push(`alias parcial=${matchedAlias}`)
  }

  if (normalizeText(descriptor.action) === normalizedMessage) {
    score += 6
    reasons.push("action exata")
  }

  const overlap = messageTokens.filter((token) => Array.from(searchTokens).some((searchToken) => tokensMatch(token, searchToken)))
  if (overlap.length > 0) {
    score += overlap.length * 1.4
    reasons.push(`tokens=${overlap.join(",")}`)
  }

  const entityModule = getEntityModuleId(descriptor)
  if (messageTokens.includes(entityModule) || messageTokens.includes(descriptor.domain) || messageTokens.includes(descriptor.entity)) {
    score += 1.5
    reasons.push(`entidade=${entityModule}`)
  }

  const verbHint = inferVerbHint(normalizedMessage)
  if (verbHint === "create" && descriptor.mutatesData) {
    score += 1.2
    reasons.push("verbo de criação")
  }
  if (verbHint === "list" && !descriptor.mutatesData && descriptor.id.includes(".list")) {
    score += 1.2
    reasons.push("verbo de listagem")
  }
  if (verbHint === "update" && descriptor.id.includes(".improve")) {
    score += 1.2
    reasons.push("verbo de atualização")
  }
  if (verbHint === "complete" && descriptor.id.includes(".complete")) {
    score += 1.2
    reasons.push("verbo de conclusão")
  }

  if (descriptor.id === "general.chat") {
    score -= 2
  }

  return {
    descriptor,
    score,
    reasons,
    overlapCount: overlap.length,
    hasRequestedMatch: requestedMatch?.id === descriptor.id,
    hasVerbHint: Boolean(verbHint),
  }
}

function shouldContinuePendingContext(message: string, pendingContext: PendingAssessorContext | null, inferredAction: string) {
  if (!pendingContext) return false

  const normalized = normalizeText(message)
  return (
    inferredAction === "general" ||
    /^\d+$/.test(normalized) ||
    /^(sim|s|primeiro|primeira|segunda|segundo|terceiro|terceira|ok|pode|gerar)$/.test(normalized) ||
    message.trim().split(/\s+/).length <= 4
  )
}

function pickCatalogCandidate(input: {
  message: string
  requestedAction?: string
  surface: CosCapabilitySurface
  pendingContext?: PendingAssessorContext | null
  legacyAction: string
}) {
  const descriptors = listCosCapabilityCatalog()
  const scoredCandidates = descriptors
    .map((descriptor) => scoreCapability(descriptor, input.message, input.requestedAction, input.surface))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => right.score - left.score)

  const topCandidate = scoredCandidates[0]
  const runnerUp = scoredCandidates[1]

  if (!topCandidate) return null

  const confidence = topCandidate.hasRequestedMatch
    ? 0.99
    : Math.max(
        0.2,
        Math.min(
          0.95,
          Number(
            (
              0.22 +
              topCandidate.overlapCount * 0.18 +
              (topCandidate.hasVerbHint ? 0.12 : 0) +
              (topCandidate.score >= 2.5 ? 0.16 : 0) +
              ((topCandidate.score ?? 0) - (runnerUp?.score ?? 0) >= 1.4 ? 0.14 : 0)
            ).toFixed(2),
          ),
        ),
      )
  const margin = Number(((topCandidate.score ?? 0) - (runnerUp?.score ?? 0)).toFixed(2))
  const requestedMatch = input.requestedAction ? getCosCapabilityDescriptorByAliasOrAction(input.requestedAction) : null

  const clearByRequest = requestedMatch?.id === topCandidate.descriptor.id
  const clearByPending =
    Boolean(input.pendingContext) &&
    input.pendingContext?.action === topCandidate.descriptor.action &&
    shouldContinuePendingContext(input.message, input.pendingContext ?? null, input.legacyAction)
  const clearByAgreement = topCandidate.descriptor.action === input.legacyAction && confidence >= 0.45
  const clearByScore = confidence >= 0.78 && margin >= 0.25

  if (!clearByRequest && !clearByPending && !clearByAgreement && !clearByScore) {
    return null
  }

  return {
    descriptor: topCandidate.descriptor,
    confidence,
    reason: clearByPending
      ? `continuidade do contexto pendente (${input.pendingContext?.missingField ?? "sem campo"})`
      : clearByRequest
        ? `requestedAction mapeada para ${topCandidate.descriptor.id}`
        : `catálogo combinou ${topCandidate.reasons.join("; ")} com margem ${margin.toFixed(2)}`,
  }
}

export function planCosCapability(input: {
  message: string
  requestedAction?: string
  pendingContext?: PendingAssessorContext | null
  surface?: CosCapabilitySurface
}): CosCapabilityPlan {
  const startedAt = Date.now()
  const surface = input.surface ?? "portal"
  const registryRequestedAction = getCosCapabilityDescriptorByAliasOrAction(input.requestedAction)?.action
  const legacyAction = inferAssessorAction(input.message, registryRequestedAction ?? input.requestedAction)
  const usePendingContext = shouldContinuePendingContext(input.message, input.pendingContext ?? null, legacyAction)
  const catalogCandidate = pickCatalogCandidate({
    message: input.message,
    requestedAction: input.requestedAction,
    surface,
    pendingContext: input.pendingContext ?? null,
    legacyAction,
  })

  const resolvedSource: CosCapabilityPlanSource = catalogCandidate ? "catalog" : "legacy"

  const resolvedAction =
    resolvedSource === "catalog"
      ? catalogCandidate?.descriptor.action ?? legacyAction
      : usePendingContext
        ? input.pendingContext?.action ?? legacyAction
        : legacyAction

  const resolvedPayload = usePendingContext && input.pendingContext ? { pendingContext: input.pendingContext } : {}
  const capability = getCosCapabilityByAction(resolvedAction)
  const capabilityId = capability.id
  const entity = getEntityModuleId(capability)
  const confidence =
    resolvedSource === "catalog"
      ? catalogCandidate?.confidence ?? 0.5
      : usePendingContext
        ? 0.66
        : capability.action === legacyAction
          ? 0.42
          : 0.35
  const reason =
    resolvedSource === "catalog"
      ? catalogCandidate?.reason ?? `catálogo selecionou ${capability.id}`
      : usePendingContext
        ? `fallback legado preservou contexto pendente para ${input.pendingContext?.missingField ?? "continuidade"}`
        : `fallback legado via inferAssessorAction(${legacyAction})`
  const resolutionMs = Date.now() - startedAt

  const plan: CosCapabilityPlan = {
    action: resolvedAction,
    payload: resolvedPayload,
    pendingContext: input.pendingContext ?? null,
    capability,
    capabilityId,
    entity,
    confidence,
    source: resolvedSource,
    reason,
    telemetry: {
      capabilityId,
      entity,
      confidence,
      source: resolvedSource,
      reason,
      fallbackUsed: resolvedSource === "legacy",
      pendingContextUsed: Boolean(usePendingContext && input.pendingContext),
      surface,
      resolutionMs,
      requestedAction: input.requestedAction?.trim() || null,
    },
  }

  console.info("[cos][planner]", {
    capabilityId,
    entity,
    source: resolvedSource,
    confidence,
    fallbackUsed: resolvedSource === "legacy",
    pendingContextUsed: plan.telemetry.pendingContextUsed,
    surface,
    resolutionMs,
    requestedAction: plan.telemetry.requestedAction,
    messageLength: input.message.trim().length,
    reason,
  })

  return plan
}
