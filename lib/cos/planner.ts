import type { PendingAssessorContext } from "@/lib/eme-backend"

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
  CosNormalizedContext,
  CosCapabilitySurface,
  CosEntityModuleId,
  CosWorkspaceContext,
  CosWorkspaceEntity,
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
  "listar",
  "lista",
  "me",
  "meu",
  "minha",
  "mostrar",
  "mostre",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "pendente",
  "pendentes",
  "para",
  "por",
  "pra",
  "quais",
  "quanto",
  "que",
  "se",
  "tem",
  "tenho",
  "um",
  "uma",
])

const STRONG_VERBS = {
  create: ["criar", "crie", "gere", "gerar", "cadastrar", "cadastre", "adicionar", "adicione", "novo", "nova"],
  search: [
    "buscar", "busque", "encontrar", "encontre", "trazer", "traga", "procurar", "procure",
    "localizar", "localize", "quero ver", "listar", "lista", "mostrar", "mostre", "quais", "ver",
  ],
  update: [
    "atualizar", "atualize", "editar", "edite", "mudar", "mude", "corrigir", "corrija",
    "melhorar", "melhore", "revisar", "revise", "ajustar", "ajuste",
  ],
  attach: ["anexar", "anexe", "vincular", "vincule", "juntar", "junte"],
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

function getWorkspaceSelectionItem(workspace: CosWorkspaceContext | null | undefined) {
  if (!workspace) return null
  return workspace.selection[0] ?? null
}

function getWorkspaceEntity(workspace: CosWorkspaceContext | null | undefined) {
  return workspace?.entity || getWorkspaceSelectionItem(workspace)?.entity || null
}

function getWorkspaceEntityId(workspace: CosWorkspaceContext | null | undefined) {
  return workspace?.entityId || getWorkspaceSelectionItem(workspace)?.entityId || null
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
  if (STRONG_VERBS.attach.some((token) => normalizedMessage.includes(token))) return "attach"
  if (STRONG_VERBS.update.some((token) => normalizedMessage.includes(token))) return "update"
  if (STRONG_VERBS.search.some((token) => normalizedMessage.includes(token))) return "search"
  return null
}

function tokensMatch(left: string, right: string) {
  if (left === right) return true
  if (left.length >= 4 && right.length >= 4 && (left.startsWith(right.slice(0, 4)) || right.startsWith(left.slice(0, 4)))) return true
  if (left.endsWith("s") && left.slice(0, -1) === right) return true
  if (right.endsWith("s") && right.slice(0, -1) === left) return true
  return false
}

function isWorkspaceRelevantEntity(workspaceEntity: CosWorkspaceEntity | null, descriptor: CosCapabilityDescriptor) {
  if (!workspaceEntity) return false

  const entityModule = getEntityModuleId(descriptor)
  if (workspaceEntity === entityModule) return true
  if (workspaceEntity === "document" && (entityModule === "contract" || entityModule === "proposal")) return true
  if (workspaceEntity === "conversation" && descriptor.id === "general.chat") return true
  return false
}

function scoreWorkspaceAffinity(descriptor: CosCapabilityDescriptor, normalizedMessage: string, workspace: CosWorkspaceContext | null | undefined) {
  const workspaceEntity = getWorkspaceEntity(workspace)
  const workspaceEntityId = getWorkspaceEntityId(workspace)

  if (!workspaceEntity) {
    return {
      score: 0,
      reasons: [] as string[],
      workspaceEntityUsed: null as CosWorkspaceEntity | null,
      workspaceEntityIdUsed: null as string | null,
    }
  }

  const reasons: string[] = []
  let score = 0

  if (isWorkspaceRelevantEntity(workspaceEntity, descriptor)) {
    score += 2.4
    reasons.push(`workspace=${workspaceEntity}`)
  }

  if (workspaceEntityId && isWorkspaceRelevantEntity(workspaceEntity, descriptor)) {
    score += 0.6
    reasons.push("workspaceId")
  }

  if (
    workspaceEntity === "agenda" &&
    descriptor.id === "agenda.create" &&
    /\b(amanha|hoje|\d{1,2}h|:\d{2}|marque|marcar|agende|agendar)\b/.test(normalizedMessage)
  ) {
    score += 3.2
    reasons.push("workspace agenda + horario")
  }

  if (workspaceEntity === "lead" && descriptor.id === "proposal.create" && /\b(proposta|propor|apresentacao)\b/.test(normalizedMessage)) {
    score += 2.2
    reasons.push("workspace lead + proposta")
  }

  if (workspaceEntity === "property" && descriptor.id === "property.description.improve" && /\b(anuncio|descricao|texto)\b/.test(normalizedMessage)) {
    score += 2.2
    reasons.push("workspace property + anuncio")
  }

  if (workspaceEntity === "property" && descriptor.id === "contract.create" && /\b(contrato|reserva|autorizacao|exclusividade)\b/.test(normalizedMessage)) {
    score += 1.8
    reasons.push("workspace property + contrato")
  }

  if (workspaceEntity === "lead" && descriptor.id === "contract.create" && /\b(contrato|compra e venda|locacao)\b/.test(normalizedMessage)) {
    score += 1.8
    reasons.push("workspace lead + contrato")
  }

  return {
    score,
    reasons,
    workspaceEntityUsed: score > 0 ? workspaceEntity : null,
    workspaceEntityIdUsed: score > 0 ? workspaceEntityId : null,
  }
}

function scoreCapability(
  descriptor: CosCapabilityDescriptor,
  message: string,
  requestedAction: string | undefined,
  surface: CosCapabilitySurface,
  workspace: CosWorkspaceContext | null | undefined,
) {
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

  const workspaceAffinity = scoreWorkspaceAffinity(descriptor, normalizedMessage, workspace)
  if (workspaceAffinity.score > 0) {
    score += workspaceAffinity.score
    reasons.push(...workspaceAffinity.reasons)
  }

  const entityModule = getEntityModuleId(descriptor)
  if (messageTokens.includes(entityModule) || messageTokens.includes(descriptor.domain) || messageTokens.includes(descriptor.entity)) {
    score += 1.5
    reasons.push(`entidade=${entityModule}`)
  }

  const verbHint = inferVerbHint(normalizedMessage)
  if (verbHint === "create" && descriptor.mutatesData) {
    score += 2.6
    reasons.push("verbo de criacao")
  }
  if (verbHint === "create" && !descriptor.mutatesData) {
    score -= 2.2
    reasons.push("verbo de criacao penaliza leitura")
  }
  if (verbHint === "search" && !descriptor.mutatesData) {
    score += 1.4
    reasons.push("verbo de busca")
  }
  if (verbHint === "search" && descriptor.mutatesData) {
    score -= 1.2
    reasons.push("verbo de busca penaliza mutacao")
  }
  if (verbHint === "update" && (descriptor.id.includes(".update") || descriptor.id.includes(".improve"))) {
    score += 1.6
    reasons.push("verbo de atualizacao")
  }
  if (verbHint === "attach" && descriptor.id.includes(".attach_document")) {
    score += 2.4
    reasons.push("verbo de anexar")
  }
  if (verbHint === "complete" && descriptor.id.includes(".complete")) {
    score += 1.2
    reasons.push("verbo de conclusao")
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
    workspaceEntityUsed: workspaceAffinity.workspaceEntityUsed,
    workspaceEntityIdUsed: workspaceAffinity.workspaceEntityIdUsed,
  }
}

function shouldContinuePendingContext(message: string, pendingContext: PendingAssessorContext | null) {
  if (!pendingContext) return false

  const normalized = normalizeText(message)
  return (
    /^\d+$/.test(normalized) ||
    /^(sim|s|primeiro|primeira|segunda|segundo|terceiro|terceira|ok|pode|gerar)$/.test(normalized) ||
    message.trim().split(/\s+/).length <= 4
  )
}

function getDirectRequestedCatalogCandidate(input: {
  requestedAction?: string
  surface: CosCapabilitySurface
}) {
  const descriptor = getCosCapabilityDescriptorByAliasOrAction(input.requestedAction)
  if (!descriptor) return null
  if (!descriptor.surfaces.includes(input.surface)) return null

  return {
    descriptor,
    confidence: 0.99,
    workspaceEntityUsed: null as CosWorkspaceEntity | null,
    workspaceEntityIdUsed: null as string | null,
    reason: `requestedAction mapeada para ${descriptor.id}`,
  }
}

function getPendingCatalogCandidate(input: {
  message: string
  pendingContext?: PendingAssessorContext | null
  surface: CosCapabilitySurface
}) {
  if (!shouldContinuePendingContext(input.message, input.pendingContext ?? null)) return null

  const descriptor = getCosCapabilityDescriptorByAliasOrAction(input.pendingContext?.action)
  if (!descriptor) return null
  if (!descriptor.surfaces.includes(input.surface)) return null

  return {
    descriptor,
    confidence: 0.82,
    workspaceEntityUsed: null as CosWorkspaceEntity | null,
    workspaceEntityIdUsed: null as string | null,
    reason: `continuidade do contexto pendente (${input.pendingContext?.missingField ?? "sem campo"})`,
  }
}

function pickCatalogCandidate(input: {
  message: string
  requestedAction?: string
  surface: CosCapabilitySurface
  pendingContext?: PendingAssessorContext | null
  workspace?: CosWorkspaceContext | null
}) {
  const descriptors = listCosCapabilityCatalog()
  const scoredCandidates = descriptors
    .map((descriptor) => scoreCapability(descriptor, input.message, input.requestedAction, input.surface, input.workspace))
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
    shouldContinuePendingContext(input.message, input.pendingContext ?? null)
  const clearByWorkspace = Boolean(topCandidate.workspaceEntityUsed && confidence >= 0.52)
  const clearByScore = confidence >= 0.78 && margin >= 0.25

  if (!clearByRequest && !clearByPending && !clearByWorkspace && !clearByScore) {
    return null
  }

  return {
    descriptor: topCandidate.descriptor,
    confidence,
    workspaceEntityUsed: topCandidate.workspaceEntityUsed,
    workspaceEntityIdUsed: topCandidate.workspaceEntityIdUsed,
    reason: clearByPending
      ? `continuidade do contexto pendente (${input.pendingContext?.missingField ?? "sem campo"})`
      : clearByRequest
        ? `requestedAction mapeada para ${topCandidate.descriptor.id}`
        : `catalogo combinou ${topCandidate.reasons.join("; ")} com margem ${margin.toFixed(2)}`,
  }
}

export function planCosCapability(input: {
  message: string
  requestedAction?: string
  pendingContext?: PendingAssessorContext | null
  context?: CosNormalizedContext | null
  surface?: CosCapabilitySurface
  workspace?: CosWorkspaceContext | null
}): CosCapabilityPlan {
  const startedAt = Date.now()
  const surface = input.context?.surface ?? input.surface ?? "portal"
  const workspace = input.context?.workspace ?? input.workspace ?? null
  const pendingContext = input.pendingContext ?? null
  const registryRequestedAction = getCosCapabilityDescriptorByAliasOrAction(input.requestedAction)?.action
  const directRequestedCandidate = getDirectRequestedCatalogCandidate({
    requestedAction: registryRequestedAction ?? input.requestedAction,
    surface,
  })
  const pendingCatalogCandidate = getPendingCatalogCandidate({
    message: input.message,
    pendingContext,
    surface,
  })
  const scoredCatalogCandidate = pickCatalogCandidate({
    message: input.message,
    requestedAction: input.requestedAction,
    surface,
    pendingContext,
    workspace,
  })
  const catalogCandidate = directRequestedCandidate ?? pendingCatalogCandidate ?? scoredCatalogCandidate
  const usePendingContext = Boolean(pendingCatalogCandidate)
  const resolvedSource: CosCapabilityPlanSource = "catalog"
  const resolvedAction = catalogCandidate?.descriptor.action ?? "general"

  const resolvedPayload = {
    ...(usePendingContext && pendingContext ? { pendingContext } : {}),
    ...(workspace ? { workspace } : {}),
    ...(input.context ? { context: input.context } : {}),
  }
  const capability = getCosCapabilityByAction(resolvedAction)
  const capabilityId = capability.id
  const entity = getEntityModuleId(capability)
  const workspaceEntityUsed = catalogCandidate?.workspaceEntityUsed ?? null
  const workspaceEntityIdUsed = catalogCandidate?.workspaceEntityIdUsed ?? null
  const contextOrigin =
    workspaceEntityUsed
      ? "workspace"
      : usePendingContext
        ? "pending_context"
        : resolvedSource === "catalog"
          ? "catalog"
          : "legacy"

  const confidence =
    catalogCandidate?.confidence ?? (usePendingContext ? 0.66 : capability.id === "general.chat" ? 0.3 : 0.5)
  const reason =
    resolvedSource === "catalog"
      ? catalogCandidate?.reason ?? `catalogo selecionou ${capability.id}`
      : "fallback seguro para atendimento geral"
  const resolutionMs = Date.now() - startedAt

  const plan: CosCapabilityPlan = {
    action: resolvedAction,
    payload: resolvedPayload,
    pendingContext,
    context: input.context ?? null,
    workspace,
    capability,
    capabilityId,
    entity,
    confidence,
    source: resolvedSource,
    reason,
    contextOrigin,
    telemetry: {
      capabilityId,
      entity,
      confidence,
      source: resolvedSource,
      reason,
      fallbackUsed: false,
      pendingContextUsed: Boolean(usePendingContext && pendingContext),
      surface,
      resolutionMs,
      requestedAction: input.requestedAction?.trim() || null,
      contextOrigin,
      workspaceReceived: Boolean(workspace),
      workspacePage: workspace?.page ?? null,
      workspaceEntity: getWorkspaceEntity(workspace),
      workspaceEntityId: getWorkspaceEntityId(workspace),
      workspaceEntityUsed,
      workspaceEntityIdUsed,
    },
  }

  console.info("[cos][planner]", {
    capabilityId,
    entity,
    source: resolvedSource,
    confidence,
    fallbackUsed: false,
    pendingContextUsed: plan.telemetry.pendingContextUsed,
    surface,
    resolutionMs,
    requestedAction: plan.telemetry.requestedAction,
    contextOrigin,
    workspacePage: plan.telemetry.workspacePage,
    workspaceEntity: plan.telemetry.workspaceEntity,
    workspaceEntityId: plan.telemetry.workspaceEntityId,
    workspaceEntityUsed,
    workspaceEntityIdUsed,
    messageLength: input.message.trim().length,
    reason,
  })

  return plan
}
