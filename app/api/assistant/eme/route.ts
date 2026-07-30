import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  DEFAULT_COS_CONVERSATION_TITLE,
  generateCosConversationTitle,
  isDefaultCosConversationTitle,
} from "@/lib/cos-conversations"
import {
  cleanText,
  getAssessorActionErrorResponse,
  getPendingAssessorContext,
  type AssessorAction,
} from "@/lib/eme-backend"
import {
  cancelWorkflow,
  createWorkflowFromExecutionPlan,
  formatCosExecutionPlanResponse,
  formatWorkflowProgress,
  getActiveWorkflow,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityLabel,
  isCosCapabilityAvailableOnSurface,
  planCosExecution,
  rebuildExecutionPlanFromWorkflow,
  resumeWorkflowExecution,
  resumeWorkflowState,
  sanitizeWorkspaceContext,
  shouldConfirmWorkflowMessage,
  shouldResumeWorkflow,
  stringifyConversationWorkflowContent,
  updateWorkflowFromExecutionResult,
  type CosWorkflow,
} from "@/lib/cos"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, getBrokerAiCreditBalance } from "@/lib/eme-plan-service"
import { getEmeCreditCost } from "@/lib/eme-plans"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function creditsResponse(broker: { aiCreditsBalance: number; aiAssistantEnabled: boolean; aiCreditsUsedThisMonth: number }) {
  return {
    credits: {
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
    },
    aiAssistantEnabled: broker.aiAssistantEnabled,
  }
}

async function getBrokerCredits(brokerId: string) {
  const [broker, credits] = await Promise.all([
    prisma.broker.findUnique({
      where: { id: brokerId },
      select: { aiAssistantEnabled: true },
    }),
    getBrokerAiCreditBalance(brokerId),
  ])

  return broker
    ? {
        aiCreditsBalance: credits.balance,
        aiAssistantEnabled: broker.aiAssistantEnabled,
        aiCreditsUsedThisMonth: credits.usedThisMonth,
      }
    : null
}

function serializeAssessorConfig(config: {
  officialNumber: string | null
  displayName: string | null
  status: string
  internalInstructions: string | null
  webhookStatus: string
} | null) {
  return {
    officialNumber: config?.officialNumber ?? "",
    displayName: config?.displayName ?? "",
    status: config?.status ?? "IN_PREPARATION",
    internalInstructions: config?.internalInstructions ?? "",
    webhookStatus: config?.webhookStatus ?? "NOT_CONFIGURED",
  }
}

function serializeConversation(document: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  const iso = document.updatedAt.toISOString()

  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt.toISOString(),
    updatedAt: iso,
    lastInteractionAt: iso,
  }
}

function isCosHomeSource(source: string) {
  return source === "cos_home"
}

function buildCosHomeUnsupportedResponse() {
  return [
    "Na Home do COS eu posso ajudar com:",
    "buscar imovel, cadastrar imovel, cadastrar cliente, criar proposta, criar contrato, abrir contratos, agendar ou consultar compromissos, analisar clientes, consultar desempenho, analisar financeiro e consultar notificacoes.",
  ].join("\n")
}

function buildCosHomeConfirmationResponse(action: AssessorAction) {
  return getCosCapabilityConfirmationMessage(action)
}

function formatWorkflowResponse(baseResponse: string, progress: string) {
  return `${progress}\n\n${baseResponse}`.trim()
}

async function touchCosConversation(input: {
  conversation: { id: string; title: string } | null
  message: string
}) {
  if (!input.conversation) return null

  const shouldPromoteTitle = isDefaultCosConversationTitle(input.conversation.title)

  return prisma.brokerDocument.update({
    where: { id: input.conversation.id },
    data: shouldPromoteTitle ? { title: generateCosConversationTitle(input.message) } : {},
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  })
}

async function resolveCosConversation(brokerId: string, conversationId: string) {
  return prisma.brokerDocument.findFirst({
    where: {
      id: conversationId,
      brokerId,
      type: "cos_conversation",
      status: { not: "archived" },
    },
    select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
  })
}

async function persistConversationWorkflow(conversationId: string, workflow: CosWorkflow | null) {
  return prisma.brokerDocument.update({
    where: { id: conversationId },
    data: { content: stringifyConversationWorkflowContent(workflow) },
    select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
  })
}

function workflowMetadata(workflow: CosWorkflow | null) {
  return workflow
    ? {
        id: workflow.id,
        status: workflow.status,
        currentStep: workflow.currentStep,
        pendingInput: workflow.pendingInput,
        totalPausedMs: workflow.totalPausedMs,
        startedAt: workflow.startedAt,
        updatedAt: workflow.updatedAt,
        completedAt: workflow.completedAt,
      }
    : null
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
  }

  try {
    const brokerCredits = await getBrokerCredits(user.broker.id)
    const [history, assessorConfig] = await Promise.all([
      prisma.emeMessage.findMany({
        where: { brokerId: user.broker.id, channel: "assessor_eme" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          message: true,
          response: true,
          detectedIntent: true,
          actionType: true,
          actionStatus: true,
          creditsUsed: true,
          createdAt: true,
        },
      }),
      prisma.assessorEmeConfig.findFirst({
        orderBy: { updatedAt: "desc" },
        select: {
          officialNumber: true,
          displayName: true,
          status: true,
          internalInstructions: true,
          webhookStatus: true,
        },
      }),
    ])

    return NextResponse.json({
      ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: false }),
      assessorConfig: serializeAssessorConfig(assessorConfig),
      history: history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O servico do Assessor EME esta indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel carregar o Assessor EME." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (typeof body?.aiAssistantEnabled !== "boolean") {
    return NextResponse.json({ error: "Informe o status do Assessor EME." }, { status: 400 })
  }

  try {
    const broker = await prisma.broker.update({
      where: { id: user.broker.id },
      data: { aiAssistantEnabled: body.aiAssistantEnabled },
      select: {
        aiCreditsBalance: true,
        aiAssistantEnabled: true,
        aiCreditsUsedThisMonth: true,
      },
    })

    return NextResponse.json(creditsResponse(broker))
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O servico do Assessor EME esta indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel atualizar o Assessor EME." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const message = cleanText(body?.message ?? body?.prompt, 3000)
  const source = cleanText(body?.source, 80)
  const conversationIdFromBody = cleanText(body?.conversationId, 80)
  const displayMessage = cleanText(body?.displayMessage, 3000) || message
  const isCancellation = Boolean(body?.cancel)
  const requestedAction = cleanText(body?.action ?? body?.actionType, 80)
  let creditsUsed = 1

  if (!message) {
    return NextResponse.json({ error: "Digite uma mensagem para o Assessor EME." }, { status: 400 })
  }

  try {
    const fromCosHome = isCosHomeSource(source)
    const metadataSource = fromCosHome ? "portal_cos_home" : "portal"
    const surface = fromCosHome ? "cos_home" : "portal"
    const workspace = sanitizeWorkspaceContext(body?.workspace, surface)

    let conversationDocument:
      | {
          id: string
          title: string
          content: string
          createdAt: Date
          updatedAt: Date
        }
      | null = null

    if (conversationIdFromBody) {
      conversationDocument = await resolveCosConversation(user.broker.id, conversationIdFromBody)
      if (!conversationDocument) {
        return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
      }
    } else {
      conversationDocument = await prisma.brokerDocument.create({
        data: {
          brokerId: user.broker.id,
          type: "cos_conversation",
          title: DEFAULT_COS_CONVERSATION_TITLE,
          content: stringifyConversationWorkflowContent(null),
          status: "active",
        },
        select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
      })
    }

    const brokerState = await prisma.broker.findUnique({
      where: { id: user.broker.id },
      select: { aiAssistantEnabled: true, aiCreditsBalance: true },
    })

    if (!brokerState) {
      return NextResponse.json({ error: "Corretor nao encontrado." }, { status: 404 })
    }

    if (!brokerState.aiAssistantEnabled && !isCancellation) {
      return NextResponse.json({ error: "Seu Assessor EME esta desativado no momento." }, { status: 403 })
    }

    if (brokerState.aiCreditsBalance < creditsUsed && !isCancellation) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          error: "Voce atingiu o limite de creditos do Assessor EME do seu plano. Adquira creditos adicionais no painel para continuar utilizando.",
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        },
        { status: 402 },
      )
    }

    const activeWorkflow = conversationDocument ? getActiveWorkflow(conversationDocument.content) : null
    const resumableWorkflow = shouldResumeWorkflow(activeWorkflow) ? activeWorkflow : null
    const pendingContext = resumableWorkflow ? null : await getPendingAssessorContext(user.broker.id, conversationDocument?.id)
    const executionPlan = resumableWorkflow
      ? null
      : planCosExecution({
          message,
          requestedAction,
          pendingContext,
          surface,
          workspace,
        })
    const action = (resumableWorkflow?.steps[resumableWorkflow.currentStep]?.action ?? executionPlan?.primaryStep.action ?? "general") as AssessorAction

    if (isCancellation) {
      const cancelledWorkflow = resumableWorkflow ? cancelWorkflow(resumableWorkflow) : null
      const responseText = cancelledWorkflow ? "Tudo bem. Workflow cancelado." : "Tudo bem. Nao executei a alteracao."
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        planner: executionPlan?.telemetry ?? null,
        workflow: workflowMetadata(cancelledWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
      } as Prisma.InputJsonObject

      const [updatedBroker, persistedConversation, touchedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
        cancelledWorkflow && conversationDocument
          ? persistConversationWorkflow(conversationDocument.id, cancelledWorkflow)
          : Promise.resolve(conversationDocument),
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            prompt: displayMessage || "Cancelar",
            response: responseText,
            actionType: action,
            creditsUsed: 0,
            channel: "assessor_eme",
            intent: action,
            actionStatus: "cancelled",
            metadata: interactionMetadata,
            errorMessage: null,
          },
        }),
        prisma.emeMessage.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            channel: "assessor_eme",
            direction: "broker_to_ai",
            message: displayMessage || "Cancelar",
            response: responseText,
            detectedIntent: action,
            actionType: action,
            actionStatus: "cancelled",
            metadata: interactionMetadata,
            errorMessage: null,
            creditsUsed: 0,
          },
        }),
      ])

      return NextResponse.json({
        response: responseText,
        action,
        actionStatus: "cancelled",
        metadata: interactionMetadata,
        creditsUsed: 0,
        conversation: serializeConversation(touchedConversation ?? persistedConversation ?? conversationDocument ?? {
          id: "",
          title: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    if (fromCosHome && executionPlan && !isCosCapabilityAvailableOnSurface(action, "cos_home")) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json({
        response: buildCosHomeUnsupportedResponse(),
        action,
        actionStatus: "unsupported",
        creditsUsed: 0,
        conversation: conversationDocument ? serializeConversation(conversationDocument) : null,
        ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    if (resumableWorkflow?.pendingInput?.field === "confirmation" && !shouldConfirmWorkflowMessage(message, Boolean(body?.confirm))) {
      const responseText = formatWorkflowResponse(buildCosHomeConfirmationResponse(action), formatWorkflowProgress(resumableWorkflow))
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        confirmationRequired: true,
        workflow: workflowMetadata(resumableWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
      } as Prisma.InputJsonObject

      const [updatedBroker, updatedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            prompt: message,
            response: responseText,
            actionType: action,
            creditsUsed: 0,
            channel: "assessor_eme",
            intent: action,
            actionStatus: "needs_confirmation",
            metadata: interactionMetadata,
            errorMessage: null,
          },
        }),
        prisma.emeMessage.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            channel: "assessor_eme",
            direction: "broker_to_ai",
            message,
            response: responseText,
            detectedIntent: action,
            actionType: action,
            actionStatus: "needs_confirmation",
            metadata: interactionMetadata,
            errorMessage: null,
            creditsUsed: 0,
          },
        }),
      ])

      return NextResponse.json({
        response: responseText,
        action,
        actionStatus: "needs_confirmation",
        metadata: interactionMetadata,
        creditsUsed: 0,
        confirmRequired: true,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    if (executionPlan?.requiresConfirmation && !body?.confirm) {
      const pendingWorkflow = createWorkflowFromExecutionPlan({
        conversationId: conversationDocument?.id ?? "ephemeral",
        plan: executionPlan,
      })
      const responseText = formatWorkflowResponse(
        executionPlan.confirmationMessage ?? buildCosHomeConfirmationResponse(action),
        formatWorkflowProgress(pendingWorkflow),
      )
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        confirmationRequired: true,
        planner: executionPlan.telemetry,
        workflow: workflowMetadata(pendingWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
      } as Prisma.InputJsonObject

      const [updatedBroker, _persistedConversation, updatedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
        conversationDocument ? persistConversationWorkflow(conversationDocument.id, pendingWorkflow) : Promise.resolve(conversationDocument),
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            prompt: message,
            response: responseText,
            actionType: action,
            creditsUsed: 0,
            channel: "assessor_eme",
            intent: action,
            actionStatus: "needs_confirmation",
            metadata: interactionMetadata,
            errorMessage: null,
          },
        }),
        prisma.emeMessage.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            channel: "assessor_eme",
            direction: "broker_to_ai",
            message,
            response: responseText,
            detectedIntent: action,
            actionType: action,
            actionStatus: "needs_confirmation",
            metadata: interactionMetadata,
            errorMessage: null,
            creditsUsed: 0,
          },
        }),
      ])

      return NextResponse.json({
        response: responseText,
        action,
        actionStatus: "needs_confirmation",
        metadata: interactionMetadata,
        creditsUsed: 0,
        confirmRequired: true,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    const workflow = resumableWorkflow
      ? resumeWorkflowState(resumableWorkflow)
      : createWorkflowFromExecutionPlan({
          conversationId: conversationDocument?.id ?? "ephemeral",
          plan: executionPlan!,
        })

    creditsUsed = workflow.steps.reduce((total, step) => total + getEmeCreditCost(step.action), 0)

    if (brokerState.aiCreditsBalance < creditsUsed) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          ...createInsufficientCreditsPayload(),
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        },
        { status: 402 },
      )
    }

    let responseText = ""
    let actionStatus = "processing"
    let errorMessage: string | null = null
    let finalCreditsUsed = 0
    const actionStartedAt = Date.now()
    let executionResult = null
    let updatedWorkflow = workflow

    try {
      executionResult = await resumeWorkflowExecution({
        workflow,
        brokerId: user.broker.id,
        userId: user.id,
        message,
        confirm: shouldConfirmWorkflowMessage(message, Boolean(body?.confirm)),
        workspace,
      })

      updatedWorkflow = updateWorkflowFromExecutionResult({
        workflow,
        result: executionResult,
      })

      actionStatus =
        updatedWorkflow.status === "awaiting_input"
          ? "processing"
          : updatedWorkflow.status === "failed"
            ? "error"
            : "success"

      finalCreditsUsed = executionResult.executedSteps.reduce((total, step) => {
        if ((step.result?.metadata as { noCharge?: boolean } | undefined)?.noCharge === true) {
          return total
        }
        return total + getEmeCreditCost(step.action)
      }, 0)

      if (finalCreditsUsed > 0) {
        await consumeBrokerAiCredits({
          brokerId: user.broker.id,
          amount: finalCreditsUsed,
          actionType: action,
          description:
            workflow.steps.length > 1
              ? `Assessor EME: workflow ${workflow.steps.map((step) => getCosCapabilityLabel(step.action)).join(" + ")}`
              : `Assessor EME: ${getCosCapabilityLabel(action)}`,
          metadata: {
            source: "api/assistant/eme",
            action,
            planId: workflow.id,
            steps: workflow.steps.map((step) => step.action),
          },
        })
      }

      const planForFormatting = executionPlan ?? rebuildExecutionPlanFromWorkflow(workflow)
      responseText = await formatCosExecutionPlanResponse({
        message,
        plan: planForFormatting,
        result: executionResult,
      })
      responseText = formatWorkflowResponse(responseText, formatWorkflowProgress(updatedWorkflow))

      console.info("[cos][workflow]", {
        workflowId: updatedWorkflow.id,
        status: updatedWorkflow.status,
        currentStep: updatedWorkflow.currentStep,
        pendingInput: updatedWorkflow.pendingInput?.field ?? null,
        stepCount: updatedWorkflow.steps.length,
        totalPausedMs: updatedWorkflow.totalPausedMs,
        durationMs: Date.now() - actionStartedAt,
      })
    } catch (caughtActionError) {
      actionStatus = "error"
      errorMessage = caughtActionError instanceof Error ? caughtActionError.message : "Erro na acao interna."
      responseText = getAssessorActionErrorResponse(action)
      finalCreditsUsed = 0
      updatedWorkflow = {
        ...workflow,
        status: "failed",
        pendingInput: null,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }

      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Erro no Assessor EME",
          message: errorMessage,
          read: false,
        },
      })
    }

    const actionMetadata = (executionResult?.metadata ?? {}) as Prisma.InputJsonObject
    const interactionMetadata = {
      ...actionMetadata,
      source: metadataSource,
      parsedIntent: action,
      actionName: action,
      brokerId: user.broker.id,
      durationMs: Date.now() - actionStartedAt,
      visualAction: getCosCapabilityLabel(action),
      planner: executionPlan?.telemetry ?? null,
      workflow: workflowMetadata(updatedWorkflow),
      conversationId: conversationDocument?.id ?? conversationIdFromBody,
      displayMessage,
    } as Prisma.InputJsonObject

    const [updatedBroker, _persistedConversation, touchedConversation] = await Promise.all([
      getBrokerCredits(user.broker.id),
      conversationDocument ? persistConversationWorkflow(conversationDocument.id, updatedWorkflow) : Promise.resolve(conversationDocument),
      touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
      prisma.aiAssistantInteraction.create({
        data: {
          userId: user.id,
          brokerId: user.broker.id,
          prompt: message,
          response: responseText,
          actionType: action,
          creditsUsed: finalCreditsUsed,
          channel: "assessor_eme",
          intent: action,
          actionStatus,
          metadata: interactionMetadata,
          errorMessage,
          leadId: executionResult?.leadId ?? null,
          propertyId: executionResult?.propertyId ?? null,
        },
      }),
      prisma.emeMessage.create({
        data: {
          userId: user.id,
          brokerId: user.broker.id,
          channel: "assessor_eme",
          direction: "broker_to_ai",
          message,
          response: responseText,
          detectedIntent: action,
          actionType: action,
          actionStatus,
          metadata: interactionMetadata,
          errorMessage,
          creditsUsed: finalCreditsUsed,
          leadId: executionResult?.leadId ?? null,
          propertyId: executionResult?.propertyId ?? null,
        },
      }),
    ])

    return NextResponse.json({
      response: responseText,
      action,
      actionStatus,
      metadata: interactionMetadata,
      creditsUsed: finalCreditsUsed,
      confirmRequired: updatedWorkflow.pendingInput?.field === "confirmation",
      conversation: touchedConversation ? serializeConversation(touchedConversation) : null,
      ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
    })
  } catch (caughtError) {
    console.error("[api][assistant][eme] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O servico do Assessor EME esta indisponivel no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel acionar o Assessor EME agora." }, { status: 500 })
  }
}
