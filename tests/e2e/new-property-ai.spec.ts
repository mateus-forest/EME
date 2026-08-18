import { expect, test } from "@playwright/test"

import {
  buildCommercialDescriptionPrompt,
  inferExplicitPropertyLocation,
  inferPropertyPurposeFromText,
  isDescriptionTooSimilarToSource,
  isDescriptionTooSimilarToSources,
} from "../../lib/property-new-ai"
import type { AdImportDraft } from "../../lib/property-ad-import-shared"
import { loginAsBroker } from "./helpers/auth"

const simpleSource =
  "Apartamento com 2 quartos no Centro de Curitiba, 80 m², uma vaga e valor de R$ 500 mil."
const commercialDescription =
  "No Centro de Curitiba, este apartamento reúne 80 m², dois dormitórios e uma vaga de garagem. O imóvel está disponível por R$ 500 mil e apresenta uma configuração prática para quem busca morar na região central da cidade."

test.describe("Novo imóvel com IA", () => {
  test("orienta a extração por fatos e detecta descrição copiada", () => {
    expect(isDescriptionTooSimilarToSource(simpleSource, simpleSource)).toBeTruthy()
    expect(isDescriptionTooSimilarToSource(simpleSource, commercialDescription)).toBeFalsy()

    const commercialPrompt = buildCommercialDescriptionPrompt({
      title: "Apartamento no Centro de Curitiba",
      description: simpleSource,
      price: "R$ 500.000,00",
      type: "Apartamento",
      city: "Curitiba",
      neighborhood: "Centro",
      address: "",
      bedrooms: 2,
      bathrooms: 0,
      parking: 1,
      area: "80 m²",
      features: [],
      tags: [],
      images: [],
      sourceUrl: "",
      notes: "",
      lowConfidenceFields: [],
      missingFields: ["banheiros"],
      status: "needs_review",
    } satisfies AdImportDraft)
    expect(commercialPrompt).toContain('"propertyFacts"')
    expect(commercialPrompt).toContain('"sourceTextToRewrite"')
    expect(commercialPrompt).toContain("Use exclusivamente os fatos")
    expect(commercialPrompt).toContain("Nao copie frases")
    expect(commercialPrompt).toContain("Nao acrescente")
    expect(commercialPrompt).toContain("Preserve nos campos estruturados toda cidade")
  })

  test("preserva localização e finalidade explicitamente informadas", () => {
    expect(inferExplicitPropertyLocation("Sala comercial em Vacaria/RS, no bairro Centro, para venda.")).toEqual({
      city: "Vacaria",
      neighborhood: "Centro",
      state: "RS",
    })
    expect(inferExplicitPropertyLocation("Tenho interesse em uma sala comercial").city).toBe("")
    expect(inferExplicitPropertyLocation("Cidade: Vacaria; bairro: Centro")).toMatchObject({ city: "Vacaria", neighborhood: "Centro" })
    expect(inferPropertyPurposeFromText("Imóvel disponível para aluguel")).toBe("Locação")
    expect(inferPropertyPurposeFromText("Casa à venda")).toBe("Venda")
  })

  test("compara a descrição por fonte sem criar sobreposição artificial entre blocos", () => {
    expect(isDescriptionTooSimilarToSources([simpleSource, "Observação curta do corretor"], simpleSource)).toBeTruthy()
    expect(isDescriptionTooSimilarToSources([simpleSource, "Observação curta do corretor"], commercialDescription)).toBeFalsy()
  })

  test("envia o workflow dedicado e aplica uma descrição comercial nova", async ({ page }) => {
    await loginAsBroker(page)
    let requestBody = ""

    await page.route("**/api/properties/import/ad/extract", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      requestBody = route.request().postData() ?? ""
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          drafts: [{
            title: "Apartamento no Centro de Curitiba",
            description: commercialDescription,
            price: "R$ 500.000,00",
            type: "Apartamento",
            city: "Curitiba",
            neighborhood: "Centro",
            address: "",
            bedrooms: 2,
            bathrooms: 0,
            parking: 1,
            area: "80 m²",
            features: [],
            tags: [],
            images: [],
            sourceUrl: "",
            notes: "",
            lowConfidenceFields: [],
            missingFields: ["banheiros"],
            status: "needs_review",
          }],
        }),
      })
    })

    await page.goto("/corretor/novo-imovel")
    await expect(page.locator("body")).toContainText("Como você quer criar este imóvel?")
    await page.getByRole("button", { name: /^Criar com IA/ }).click()
    await page.getByPlaceholder(/Descreva o imóvel em texto livre/).fill(simpleSource)
    await page.getByRole("button", { name: "Gerar primeira prévia", exact: true }).click()

    await expect(page.getByPlaceholder("Revise a descrição gerada pela IA antes de publicar.")).toHaveValue(
      commercialDescription,
    )
    expect(requestBody).toContain('name="workflow"')
    expect(requestBody).toContain("new_property")
    expect(commercialDescription).not.toBe(simpleSource)
  })
})
