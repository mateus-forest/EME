import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { validateCreciWithImobisec } from "@/lib/imobisec-client"

const NOW = new Date("2026-08-16T12:00:00.000Z")

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function activePayload(overrides: Record<string, unknown> = {}) {
  return {
    creci: 123456,
    name: "João da Silva",
    state: "SP",
    status: "ATIVO",
    type: "PF",
    ...overrides,
  }
}

function validate(
  fetchImpl: NonNullable<Parameters<typeof validateCreciWithImobisec>[1]["fetchImpl"]>,
  input: Partial<Parameters<typeof validateCreciWithImobisec>[0]> = {},
) {
  return validateCreciWithImobisec(
    {
      state: "SP",
      creci: "123456",
      informedName: "João Silva",
      ...input,
    },
    {
      apiKey: "test-token",
      fetchImpl,
      now: () => NOW,
      timeoutMs: 20,
    },
  )
}

test.describe("IMOBISEC — validação de CRECI", () => {
  test("cadastro envia UF e número separadamente sem credencial do provider", async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    let requestHeaders: Record<string, string> = {}

    await page.route("**/api/auth/register", async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>
      requestHeaders = route.request().headers()
      await route.fulfill({ status: 422, json: { error: "CRECI não localizado para a UF informada." } })
    })

    await page.goto("/")
    await page.getByRole("button", { name: /Começar agora|Criar conta/ }).click()
    const dialog = page.getByRole("dialog", { name: "Criar conta no EME" })
    await dialog.getByLabel("Nome").fill("João Silva")
    await dialog.getByLabel("UF do CRECI").selectOption("SP")
    await dialog.getByLabel("Número do CRECI").fill("123456")
    await dialog.getByLabel("Email").fill("joao@example.com")
    await dialog.getByLabel("Senha", { exact: true }).fill("senha-segura")
    await dialog.getByLabel("Confirmar senha").fill("senha-segura")
    await dialog.getByRole("button", { name: "Criar conta", exact: true }).click()

    await expect(dialog.getByText("CRECI não localizado para a UF informada.")).toBeVisible()
    expect(requestBody).toMatchObject({ creciUf: "SP", creci: "123456" })
    expect(requestBody).not.toHaveProperty("IMOBISEC_API_KEY")
    expect(requestHeaders).not.toHaveProperty("x-api-token-key")
  })

  test("registro ativo e compatível é verificado usando o contrato oficial", async () => {
    let requestedUrl = ""
    let requestedToken = ""

    const result = await validate(async (input, init) => {
      requestedUrl = String(input)
      requestedToken = new Headers(init?.headers).get("X-API-Token-Key") ?? ""
      return jsonResponse(200, activePayload())
    })

    expect(result).toMatchObject({
      status: "VERIFIED",
      reason: "ACTIVE",
      creci: "123456",
      state: "SP",
      provider: "IMOBISEC",
      officialName: "João da Silva",
      providerStatus: "ATIVO",
      nameMismatch: false,
    })
    expect(requestedUrl).toBe("https://api.imobisec.com.br/crecies/SP/123456/PF")
    expect(requestedToken).toBe("test-token")
    expect(requestedUrl).not.toContain("test-token")
  })

  test("registro inexistente é rejeitado", async () => {
    const result = await validate(async () => jsonResponse(404, { title: "Not Found", status: 404 }))

    expect(result.status).toBe("REJECTED")
    expect(result.reason).toBe("NOT_FOUND")
  })

  for (const providerStatus of ["INATIVO", "SUSPENSO", "CANCELADO"]) {
    test(`status cadastral ${providerStatus} é rejeitado`, async () => {
      const result = await validate(async () => jsonResponse(200, activePayload({ status: providerStatus })))

      expect(result.status).toBe("REJECTED")
      expect(result.reason).toBe("INACTIVE")
      expect(result.providerStatus).toBe(providerStatus)
    })
  }

  test("divergência relevante de nome exige revisão sem rejeição literal", async () => {
    const result = await validate(
      async () => jsonResponse(200, activePayload({ name: "Maria Oliveira" })),
      { informedName: "João Silva" },
    )

    expect(result.status).toBe("REVIEW_REQUIRED")
    expect(result.reason).toBe("NAME_MISMATCH")
    expect(result.nameMismatch).toBe(true)
  })

  test("variação não literal do mesmo nome continua válida", async () => {
    const result = await validate(
      async () => jsonResponse(200, activePayload({ name: "João Pedro da Silva" })),
      { informedName: "João Silva" },
    )

    expect(result.status).toBe("VERIFIED")
    expect(result.nameMismatch).toBe(false)
  })

  test("status não enumerado pelo OpenAPI exige revisão", async () => {
    const result = await validate(async () => jsonResponse(200, activePayload({ status: "EM_ANALISE" })))

    expect(result.status).toBe("REVIEW_REQUIRED")
    expect(result.reason).toBe("AMBIGUOUS_RESPONSE")
    expect(result.providerStatus).toBe("EM_ANALISE")
  })

  test("erro do provider nunca aprova automaticamente", async () => {
    const result = await validate(async () => jsonResponse(500, { title: "Internal Server Error", status: 500 }))

    expect(result.status).toBe("PENDING")
    expect(result.reason).toBe("PROVIDER_ERROR")
  })

  test("erro de autenticação do provider fica pendente", async () => {
    const result = await validate(async () => jsonResponse(401, { title: "Unauthorized", status: 401 }))

    expect(result.status).toBe("PENDING")
    expect(result.reason).toBe("AUTHENTICATION_ERROR")
  })

  test("timeout deixa a validação pendente", async () => {
    const result = await validate((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")))
    }))

    expect(result.status).toBe("PENDING")
    expect(result.reason).toBe("TIMEOUT")
  })

  test("chave ausente deixa a validação pendente e não chama a rede", async () => {
    let called = false
    const result = await validateCreciWithImobisec(
      { state: "SP", creci: "123456", informedName: "João Silva" },
      {
        apiKey: "",
        fetchImpl: async () => {
          called = true
          return jsonResponse(200, activePayload())
        },
        now: () => NOW,
      },
    )

    expect(result.status).toBe("PENDING")
    expect(result.reason).toBe("CONFIGURATION_ERROR")
    expect(called).toBe(false)
  })

  test("payload inconsistente não é aprovado", async () => {
    const result = await validate(async () => jsonResponse(200, activePayload({ state: "RJ" })))

    expect(result.status).toBe("REVIEW_REQUIRED")
    expect(result.reason).toBe("AMBIGUOUS_RESPONSE")
  })

  test("a variável secreta não aparece nos componentes cliente", () => {
    const clientFiles = [
      "components/eme/auth-panel.tsx",
      "components/auth-v0-experience.tsx",
      "components/signup-broker-page.tsx",
      "components/use-broker-profile.ts",
      "components/broker-account-page.tsx",
    ]

    for (const file of clientFiles) {
      expect(readFileSync(join(process.cwd(), file), "utf8"), file).not.toContain("IMOBISEC_API_KEY")
      expect(readFileSync(join(process.cwd(), file), "utf8"), file).not.toContain("X-API-Token-Key")
    }

    expect(readFileSync(join(process.cwd(), "lib/imobisec.server.ts"), "utf8")).toContain("IMOBISEC_API_KEY")
  })
})
