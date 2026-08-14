import { expect, test } from "@playwright/test"

import {
  buildCosConversationResponse,
  classifyCosSocialIntent,
  getSafeFirstName,
} from "@/lib/cos/conversation"
import { resolveCosConversationCategory } from "@/lib/cos-conversations"
import { EME_FREE_COS_ACTIONS } from "@/lib/eme-plans"

const socialMessages = [
  ["oi", "greeting"],
  ["olá", "greeting"],
  ["bom dia", "greeting"],
  ["boa tarde", "greeting"],
  ["boa noite", "greeting"],
  ["olá, bom dia!", "greeting"],
  ["tudo bem?", "check_in"],
  ["oi, tudo certo?", "greeting"],
  ["o que você consegue fazer?", "capabilities"],
  ["como você pode me ajudar?", "capabilities"],
  ["me fala o que você faz", "capabilities"],
  ["obrigado", "gratitude"],
  ["valeu mesmo", "gratitude"],
] as const

test.describe("COS — conversa social", () => {
  for (const [message, expectedIntent] of socialMessages) {
    test(`reconhece ${message} sem iniciar intenção operacional`, () => {
      expect(classifyCosSocialIntent(message)).toBe(expectedIntent)
      const response = buildCosConversationResponse({ message, firstName: "Mateus" })
      expect(response.trim().length).toBeGreaterThan(10)
      expect(response).not.toMatch(/escolha a operação|fallback|pending|workflow/i)
    })
  }

  test("personaliza com primeiro nome seguro quando disponível", () => {
    const response = buildCosConversationResponse({ message: "Oi", firstName: "Mateus da Silva" })
    expect(response).toContain("Mateus")
    expect(response).not.toContain("da Silva")
  })

  test("funciona naturalmente sem nome e não inventa identificação", () => {
    const response = buildCosConversationResponse({ message: "Oi", firstName: null })
    expect(response).toMatch(/^(Oi|Olá|Opa)!/)
    expect(response).toMatch(/ajudar|executar|resolver/i)
    expect(response).not.toContain("Mateus")
  })

  test("não captura pedidos operacionais que começam com saudação", () => {
    expect(classifyCosSocialIntent("Oi, crie um imóvel para mim")).toBeNull()
    expect(classifyCosSocialIntent("Bom dia, quero cadastrar um cliente")).toBeNull()
    expect(classifyCosSocialIntent("Busque imóveis em Curitiba")).toBeNull()
  })

  test("sanitiza o primeiro nome e mantém general.chat gratuito", () => {
    expect(getSafeFirstName("  Ana Maria  ")).toBe("Ana")
    expect(getSafeFirstName("mateus@example.com")).toBeNull()
    expect(EME_FREE_COS_ACTIONS.has("general")).toBeTruthy()
  })

  test("categoriza histórico pela metadata real e usa o título apenas como compatibilidade", () => {
    expect(resolveCosConversationCategory({ entity: "lead", action: "UPDATE_LEAD", title: "Assunto genérico" })).toBe("clients")
    expect(resolveCosConversationCategory({ capabilityId: "property.search", title: "Assunto genérico" })).toBe("properties")
    expect(resolveCosConversationCategory({ action: "CREATE_CONTRACT", title: "Assunto genérico" })).toBe("contracts")
    expect(resolveCosConversationCategory({ title: "Agendar visita amanhã" })).toBe("agenda")
    expect(resolveCosConversationCategory({ title: "Olá, tudo bem?" })).toBe("general")
  })
})
