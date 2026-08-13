import type { CosConversationMemory, CosWorkspaceContext } from "@/lib/cos/types"

export type CosSocialIntent =
  | "greeting"
  | "check_in"
  | "gratitude"
  | "capabilities"
  | "identity"
  | "farewell"
  | "acknowledgement"

type CosConversationResponseInput = {
  message: string
  intent?: CosSocialIntent | null
  firstName?: string | null
  memory?: CosConversationMemory | null
  workspace?: CosWorkspaceContext | null
  now?: Date
}

export const COS_GENERAL_CHAT_OPTIONS = [
  { id: "general_clients", actionId: "general:clients", action: "FIND_LEAD", message: "Clientes", label: "Clientes" },
  { id: "general_properties", actionId: "general:properties", action: "searchProperties", message: "Buscar imóveis", label: "Buscar imóveis" },
  { id: "general_proposal", actionId: "general:proposal", action: "CREATE_PROPOSAL", message: "Criar proposta", label: "Criar proposta" },
  { id: "general_contract", actionId: "general:contract", action: "CREATE_CONTRACT", message: "Novo contrato", label: "Novo contrato" },
  { id: "general_agenda", actionId: "general:agenda", action: "CREATE_AGENDA_EVENT", message: "Agenda", label: "Agenda" },
] as const

export function normalizeConversationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getSafeFirstName(value: unknown) {
  if (typeof value !== "string") return null
  const firstToken = value.trim().split(/\s+/)[0] ?? ""
  if (!firstToken || firstToken.includes("@")) return null
  const firstName = firstToken.replace(/[^\p{L}'’-]/gu, "")
  if (!firstName || firstName.length > 40) return null
  return firstName
}

export function classifyCosSocialIntent(message: string): CosSocialIntent | null {
  const normalized = normalizeConversationText(message)
  if (!normalized || normalized.length > 180) return null

  const greeting = /^(?:(?:oi+|oie+|ola+|opa|e ai|ei|salve|fala)(?: cos)?(?: bom dia| boa tarde| boa noite)?|(?:bom dia|boa tarde|boa noite)(?: cos)?)(?: tudo (?:bem|certo|tranquilo)| beleza| como (?:vai|voce esta))?$/u
  const checkIn = /^(?:tudo (?:bem|certo|tranquilo)(?: por ai| com voce)?|como (?:vai|voce esta|estao as coisas)|beleza(?: por ai)?|ta tudo bem)(?: cos)?$/u
  const gratitude = /^(?:muito )?(?:obrigad[oa]|obrigadao|valeu|agradeco|grato|grata)(?: mesmo| pela ajuda| por isso| por enquanto| cos)?$/u
  const capabilities = /^(?:(?:o que|que|o que e que) (?:voce|o cos) (?:faz|consegue fazer|pode fazer)(?: por mim)?|(?:me (?:diz|fala) )?o que (?:voce|o cos) (?:faz|consegue fazer)|como (?:voce|o cos) (?:pode|consegue) me ajudar(?: hoje)?|com o que (?:voce|o cos) (?:pode|consegue) (?:me )?ajudar|quais (?:sao )?(?:as )?(?:suas|do cos) (?:funcoes|capacidades)|para que (?:voce|o cos) serve)$/u
  const identity = /^(?:quem e voce|quem e o cos|o que e o cos|qual (?:e )?o seu nome|como voce se chama)$/u
  const farewell = /^(?:tchau|ate mais|ate logo|falou|bom trabalho|boa semana|bom fim de semana)(?: cos)?$/u
  const acknowledgement = /^(?:legal|bacana|perfeito|show|entendi|combinado|maravilha)(?: cos)?$/u

  if (greeting.test(normalized)) return "greeting"
  if (checkIn.test(normalized)) return "check_in"
  if (gratitude.test(normalized)) return "gratitude"
  if (capabilities.test(normalized)) return "capabilities"
  if (identity.test(normalized)) return "identity"
  if (farewell.test(normalized)) return "farewell"
  if (acknowledgement.test(normalized)) return "acknowledgement"
  return null
}

function pick<T>(values: readonly T[], seed: string) {
  let hash = 0
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return values[hash % values.length]
}

function getDayPeriod(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(now),
  )
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

function greetingFromMessage(message: string) {
  const normalized = normalizeConversationText(message)
  if (normalized.includes("bom dia")) return "Bom dia"
  if (normalized.includes("boa tarde")) return "Boa tarde"
  if (normalized.includes("boa noite")) return "Boa noite"
  if (normalized.startsWith("ola")) return "Olá"
  if (normalized.startsWith("opa")) return "Opa"
  return "Oi"
}

function withName(greeting: string, firstName: string | null) {
  return firstName ? `${greeting}, ${firstName}!` : `${greeting}!`
}

export function buildCosConversationResponse(input: CosConversationResponseInput) {
  const intent = input.intent ?? classifyCosSocialIntent(input.message)
  const firstName = getSafeFirstName(input.firstName)
  const now = input.now ?? new Date()
  const previousMessage = input.memory?.lastUserMessage ?? ""
  const seed = `${normalizeConversationText(input.message)}:${normalizeConversationText(previousMessage)}:${input.workspace?.page ?? "cos"}:${getDayPeriod(now)}`

  if (intent === "greeting") {
    const greeting = greetingFromMessage(input.message)
    return pick([
      `${withName(greeting, firstName)} Tudo bem? Como posso te ajudar hoje? O que vamos executar?`,
      `${withName(greeting, firstName)} Estou por aqui. O que você quer resolver ou executar agora?`,
      `${withName(greeting, firstName)} Tudo certo? Me diga o que você precisa e eu te ajudo a executar.`,
    ], seed)
  }

  if (intent === "check_in") {
    return pick([
      `${firstName ? `Tudo certo, ${firstName}` : "Tudo certo"}! Estou pronto para ajudar. O que vamos executar hoje?`,
      `Tudo bem por aqui${firstName ? `, ${firstName}` : ""}! E com você? Quando quiser, me diga o que precisamos resolver.`,
    ], seed)
  }

  if (intent === "gratitude") {
    return pick([
      `Por nada${firstName ? `, ${firstName}` : ""}! Quando precisar, é só me dizer o que vamos executar.`,
      `Conte comigo${firstName ? `, ${firstName}` : ""}! Se houver mais alguma coisa para resolver, podemos seguir.`,
      `Disponha${firstName ? `, ${firstName}` : ""}! Estou por aqui para o próximo passo.`,
    ], seed)
  }

  if (intent === "capabilities") {
    return "Posso buscar e cadastrar clientes e imóveis, criar propostas e contratos, organizar compromissos, consultar a operação e apoiar o Studio IA. Você me diz o objetivo e eu ajudo a executar o próximo passo."
  }

  if (intent === "identity") {
    return "Sou o COS, o Conversation Operational System do EME. Eu converso com você, entendo o contexto da operação e ajudo a executar tarefas do dia a dia imobiliário."
  }

  if (intent === "farewell") {
    return pick([
      `Até mais${firstName ? `, ${firstName}` : ""}! Quando precisar executar algo, estarei por aqui.`,
      `Combinado${firstName ? `, ${firstName}` : ""}. Bom trabalho e até a próxima!`,
    ], seed)
  }

  if (intent === "acknowledgement") {
    return `Perfeito${firstName ? `, ${firstName}` : ""}. Estou por aqui — qual é o próximo passo?`
  }

  return `Entendi${firstName ? `, ${firstName}` : ""}. Posso ajudar a transformar isso em uma ação no EME. O que você quer resolver agora?`
}
