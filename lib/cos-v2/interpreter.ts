import "server-only"

import { createHash } from "crypto"
import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import { classifyCosPendingReply } from "@/lib/cos/pending-input"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"
import { listCosV2Capabilities, resolveCosV2Capability } from "@/lib/cos-v2/capabilities"
import type { CosV2CompactContext, CosV2Domain, CosV2Interpretation, CosV2TurnInput } from "@/lib/cos-v2/types"

const turnSchema = z.object({
  schemaVersion: z.literal(2),
  turnType: z.enum(["question", "context", "execution", "correction", "selection", "confirmation", "cancellation"]),
  objective: z.object({
    kind: z.enum(["answer", "query", "execute", "context"]),
    summary: z.string().trim().min(1).max(220),
  }),
  primaryDomain: z.enum(["clients", "properties", "proposals", "agenda", "general"]),
  secondaryDomains: z.array(z.enum(["clients", "properties", "proposals", "agenda", "general"])).max(4),
  entities: z.array(z.object({
    type: z.enum(["client", "property", "proposal", "appointment"]),
    id: z.string().trim().min(1).max(191).nullable(),
    name: z.string().trim().min(1).max(180).nullable(),
    role: z.enum(["subject", "beneficiary", "target", "comparison", "context"]),
  })).max(12),
  references: z.array(z.object({
    expression: z.string().trim().min(1).max(180),
    type: z.enum(["client", "property", "proposal", "appointment"]).nullable(),
    id: z.string().trim().min(1).max(191).nullable(),
    relation: z.enum(["active", "previous", "alternative", "selection", "named", "unknown"]),
  })).max(12),
  filters: z.array(z.object({
    field: z.string().trim().min(1).max(80),
    operator: z.enum(["eq", "neq", "lt", "lte", "gt", "gte", "contains", "in", "between"]),
    value: z.string().max(240),
  })).max(18),
  providedData: z.array(z.object({
    field: z.string().trim().min(1).max(80),
    value: z.string().max(320),
  })).max(24),
  corrections: z.array(z.object({
    field: z.string().trim().min(1).max(80),
    from: z.string().max(240).nullable(),
    to: z.string().trim().min(1).max(320),
  })).max(12),
  missingData: z.array(z.string().trim().min(1).max(80)).max(12),
  intendedAction: z.string().trim().min(1).max(120).nullable(),
  steps: z.array(z.object({
    action: z.string().trim().min(1).max(120),
    goal: z.string().trim().min(1).max(180),
  })).max(4),
  confidence: z.number().min(0).max(1),
  clarificationQuestion: z.string().trim().min(1).max(240).nullable(),
  responseFocus: z.enum(["overview", "how_to", "comparison", "status", "direct"]),
  helpTopic: z.enum(["first_steps", "using_cos", "registering_properties", "managing_clients", "proposals", "general"]).nullable(),
})

export type CosV2InterpretationAudit = {
  status: "deterministic" | "accepted" | "disabled" | "unavailable" | "invalid" | "error"
  source: CosV2Interpretation["source"]
  model: string | null
  promptHash: string | null
  durationMs: number
  errors: string[]
}

export type CosV2InterpretationResult = {
  interpretation: CosV2Interpretation
  audit: CosV2InterpretationAudit
}

function baseInterpretation(input: Partial<CosV2Interpretation> & Pick<CosV2Interpretation, "turnType" | "source">): CosV2Interpretation {
  return {
    schemaVersion: 2,
    turnType: input.turnType,
    objective: input.objective ?? { kind: "context", summary: "Entender o próximo passo da conversa." },
    primaryDomain: input.primaryDomain ?? "general",
    secondaryDomains: input.secondaryDomains ?? [],
    entities: input.entities ?? [],
    references: input.references ?? [],
    filters: input.filters ?? [],
    providedData: input.providedData ?? [],
    corrections: input.corrections ?? [],
    missingData: input.missingData ?? [],
    intendedAction: input.intendedAction ?? null,
    steps: input.steps ?? [],
    confidence: input.confidence ?? 1,
    clarificationQuestion: input.clarificationQuestion ?? null,
    responseFocus: input.responseFocus ?? "direct",
    helpTopic: input.helpTopic ?? null,
    source: input.source,
  }
}

function domainForCapabilityId(capabilityId: string): CosV2Domain {
  if (capabilityId.startsWith("lead.")) return "clients"
  if (capabilityId.startsWith("property.")) return "properties"
  if (capabilityId.startsWith("proposal.")) return "proposals"
  if (capabilityId.startsWith("agenda.")) return "agenda"
  return "general"
}

function structuredHelp(action: string) {
  const normalized = action.trim().toLowerCase()
  if (normalized === "help_first_steps") return { domain: "general", topic: "first_steps" } as const
  if (normalized === "help_use_cos") return { domain: "general", topic: "using_cos" } as const
  if (normalized === "help_register_properties") return { domain: "properties", topic: "registering_properties" } as const
  if (normalized === "help_manage_clients") return { domain: "clients", topic: "managing_clients" } as const
  if (normalized === "help_contracts_proposals") return { domain: "proposals", topic: "proposals" } as const
  if (normalized === "help_general_question") return { domain: "general", topic: "general" } as const
  return null
}

function deterministicInterpretation(input: CosV2TurnInput): CosV2Interpretation | null {
  const pending = input.pendingInput

  if (input.cancel) {
    return baseInterpretation({
      turnType: "cancellation",
      source: "structured_action",
      objective: { kind: "context", summary: "Cancelar a operação pendente." },
      intendedAction: pending?.capabilityId ?? input.structuredAction,
      primaryDomain: pending?.capabilityId ? domainForCapabilityId(pending.capabilityId) : "general",
    })
  }

  if (input.confirm && pending?.field === "confirmation") {
    return baseInterpretation({
      turnType: "confirmation",
      source: "structured_action",
      objective: { kind: "execute", summary: "Confirmar a operação pendente." },
      intendedAction: pending.capabilityId ?? pending.action,
      primaryDomain: pending.capabilityId ? domainForCapabilityId(pending.capabilityId) : "general",
    })
  }

  if (input.selectedOptionId && pending?.type === "selection") {
    const selected = (pending.options ?? []).find((option) => option.id === input.selectedOptionId)
    if (!selected) return null
    return baseInterpretation({
      turnType: "selection",
      source: "pending",
      objective: { kind: "execute", summary: `Continuar com ${selected.label}.` },
      intendedAction: pending.capabilityId ?? pending.action,
      primaryDomain: pending.capabilityId ? domainForCapabilityId(pending.capabilityId) : "general",
      entities: [],
      references: [{ expression: selected.label, type: null, id: selected.id, relation: "selection" }],
      providedData: [{ field: pending.field, value: selected.id }],
    })
  }

  if (pending?.field === "confirmation") {
    const reply = classifyCosPendingReply(input.message)
    if (reply === "confirm") {
      return baseInterpretation({
        turnType: "confirmation",
        source: "pending",
        objective: { kind: "execute", summary: "Confirmar a operação pendente." },
        intendedAction: pending.capabilityId ?? pending.action,
        primaryDomain: pending.capabilityId ? domainForCapabilityId(pending.capabilityId) : "general",
      })
    }
    if (reply === "cancel" || reply === "reject") {
      return baseInterpretation({
        turnType: "cancellation",
        source: "pending",
        objective: { kind: "context", summary: "Não continuar a operação pendente." },
        intendedAction: pending.capabilityId ?? pending.action,
        primaryDomain: pending.capabilityId ? domainForCapabilityId(pending.capabilityId) : "general",
      })
    }
  }

  if (pending && isSimplePendingValue(pending.type, input.message)) {
    return baseInterpretation({
      turnType: "execution",
      source: "pending",
      objective: { kind: "execute", summary: `Informar ${pending.label.toLowerCase()} e continuar.` },
      intendedAction: pending.capabilityId ?? pending.action,
      primaryDomain: pending.capabilityId ? domainForCapabilityId(pending.capabilityId) : "general",
      providedData: [{ field: pending.field, value: input.message.trim() }],
    })
  }

  if (input.structuredAction) {
    const help = structuredHelp(input.structuredAction)
    if (help) {
      return baseInterpretation({
        turnType: "question",
        source: "structured_action",
        objective: { kind: "answer", summary: `Responder especificamente sobre ${help.topic}.` },
        primaryDomain: help.domain,
        responseFocus: "how_to",
        helpTopic: help.topic,
      })
    }
    const descriptor = resolveCosV2Capability(input.structuredAction, input.surface)
    const capabilityId = descriptor?.id ?? input.structuredAction
    return baseInterpretation({
      turnType: "execution",
      source: "structured_action",
      objective: {
        kind: descriptor?.mutatesData ? "execute" : "query",
        summary: descriptor?.title ?? "Executar a ação estruturada solicitada.",
      },
      primaryDomain: descriptor ? domainForCapabilityId(descriptor.id) : "general",
      intendedAction: capabilityId,
      steps: [{ action: capabilityId, goal: descriptor?.title ?? "Ação solicitada" }],
    })
  }

  return null
}

function isSimplePendingValue(type: string, message: string) {
  const value = message.trim()
  if (!value || value.length > 120 || value.includes("?")) return false
  if (type === "phone") return value.replace(/\D/g, "").length >= 8
  if (type === "currency") return /\d/.test(value)
  if (type === "time") return /\b\d{1,2}(?::\d{2}|h(?:\d{2})?)\b/i.test(value)
  return false
}

function parseOutput(response: { output_text?: string; output_parsed?: unknown }) {
  if (response.output_parsed) return response.output_parsed
  if (!response.output_text?.trim()) return null
  return JSON.parse(response.output_text)
}

function promptForTurn(input: CosV2TurnInput, context: CosV2CompactContext) {
  const capabilities = listCosV2Capabilities(input.surface).map((capability) => ({
    id: capability.id,
    title: capability.title,
    description: capability.description,
    mutatesData: capability.mutatesData,
    requiresConfirmation: capability.requiresConfirmation,
    requiresSelection: capability.requiresSelection,
    requiredInputs: capability.inputContract?.required ?? [],
    optionalInputs: capability.inputContract?.optional ?? [],
  }))
  return JSON.stringify({
    task: [
      "Interprete a mensagem sem executar nada.",
      "Pergunta sobre o produto ou capacidade usa objective.kind=answer e nunca executa handler.",
      "Consulta de dados reais usa objective.kind=query e somente capability não mutável.",
      "Uma declaração de situação usa turnType=context; não transforme contexto em execução.",
      "turnType=question nunca usa objective.kind=execute; turnType=context sempre usa objective.kind=context.",
      "Para 'tenho um cliente interessado em uma sala comercial', mantenha contexto comercial e, sem cliente ativo, pergunte somente 'Qual cliente?'.",
      "Use somente ids de entidades presentes no contexto. Nunca invente ids.",
      "Use intendedAction e steps somente com ids da lista de capabilities.",
      "Use o inputContract da capability como autoridade: missingData contém somente requiredInputs ausentes; optionalInputs nunca impedem execução.",
      "Se os requiredInputs estiverem presentes, use turnType=execution e objective.kind=execute/query para deixar o handler validar e executar.",
      "Se a última ação concluída criou uma única entidade e a nova mensagem acrescenta ou corrige dados dela de forma inequívoca, trate como correction e escolha a capability de atualização registrada; não reabra o cadastro concluído para pedir opcionais.",
      "Em perguntas de ajuda, preencha helpTopic com o assunto exato: first_steps, using_cos, registering_properties, managing_clients, proposals ou general. Tópicos diferentes exigem respostas diferentes.",
      "Em pedido composto simples, ordene até quatro steps. Em correção, preserve a operação pendente quando ela for o alvo.",
    ],
    message: input.message,
    context,
    capabilities,
  })
}

export async function interpretCosV2Turn(input: CosV2TurnInput, context: CosV2CompactContext): Promise<CosV2InterpretationResult> {
  const startedAt = Date.now()
  const deterministic = deterministicInterpretation(input)
  if (deterministic) {
    return {
      interpretation: deterministic,
      audit: { status: "deterministic", source: deterministic.source, model: null, promptHash: null, durationMs: Date.now() - startedAt, errors: [] },
    }
  }

  let environment: ReturnType<typeof getOpenAIEnv>
  try {
    environment = getOpenAIEnv()
  } catch (caughtError) {
    const fallback = unavailableInterpretation(input)
    return {
      interpretation: fallback,
      audit: { status: "unavailable", source: "openai", model: null, promptHash: null, durationMs: Date.now() - startedAt, errors: [caughtError instanceof Error ? caughtError.message : "openai_environment_unavailable"] },
    }
  }
  const client = getOpenAIClient()
  if (!environment.enabled || !client) {
    const fallback = unavailableInterpretation(input)
    return {
      interpretation: fallback,
      audit: { status: environment.enabled ? "unavailable" : "disabled", source: "openai", model: environment.enabled ? environment.model : null, promptHash: null, durationMs: Date.now() - startedAt, errors: [environment.enabled ? "openai_client_unavailable" : "openai_disabled"] },
    }
  }

  const prompt = promptForTurn(input, context)
  const promptHash = createHash("sha256").update(prompt).digest("hex")
  try {
    const response = await createOpenAIResponse({
      client,
      operationKey: "cos.v2.interpretation",
      metadata: { runtimeVersion: "v2", surface: input.surface },
      request: {
        model: environment.model,
        max_output_tokens: 1800,
        reasoning: { effort: "minimal" },
        instructions: "Você é o interpretador semântico do COS V2. Produza somente o objeto estruturado solicitado. Não execute, não declare sucesso e não crie capabilities ou ids.",
        input: prompt,
        text: { verbosity: "low", format: zodTextFormat(turnSchema, "cos_v2_turn_interpretation") },
      },
    })
    const parsed = turnSchema.parse(parseOutput(response as { output_text?: string; output_parsed?: unknown }))
    const interpretation = { ...parsed, source: "openai" as const } satisfies CosV2Interpretation
    return {
      interpretation,
      audit: { status: "accepted", source: "openai", model: environment.model, promptHash, durationMs: Date.now() - startedAt, errors: [] },
    }
  } catch (caughtError) {
    const fallback = unavailableInterpretation(input)
    return {
      interpretation: fallback,
      audit: { status: caughtError instanceof z.ZodError ? "invalid" : "error", source: "openai", model: environment.model, promptHash, durationMs: Date.now() - startedAt, errors: [caughtError instanceof Error ? caughtError.message : "cos_v2_interpretation_failed"] },
    }
  }
}

function unavailableInterpretation(input: CosV2TurnInput) {
  return baseInterpretation({
    turnType: "context",
    source: "openai",
    objective: { kind: "context", summary: "Pedir uma reformulação curta sem iniciar operação." },
    clarificationQuestion: "Não consegui entender bem. Pode dizer em uma frase o que você quer fazer?",
    confidence: 0,
  })
}
