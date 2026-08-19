import { expect, test, type Page } from "@playwright/test"
import JSZip from "jszip"
import PDFDocument from "pdfkit"

import { extractContractTemplateText } from "../../lib/contract-document-parser.server"
import { generateContractPdf } from "../../lib/contract-pdf.server"
import {
  buildContractTemplateStructure,
  buildTextOnlyContractTemplateStructure,
  calculateContractReadiness,
  contractBindingOptions,
  contractFieldBindingSchema,
  inspectContractTemplateStructure,
  normalizeAnalyzedContractTemplateStructure,
  renderContractTemplateHtml,
  shouldCreateContractTemplateVersion,
  splitContractTextIntoBlocks,
  validateContractTemplateOccurrences,
} from "../../lib/contract-template-engine"
import {
  mergeKnownContractValues,
  reconcileAdditionalPartyContractValues,
  resolveAdditionalPartyContractBinding,
} from "../../lib/contract-template-bindings"
import { loginAsBroker } from "./helpers/auth"

const structure = buildContractTemplateStructure(
  splitContractTextIntoBlocks("CONTRATO PARTICULAR DE LOCAÇÃO\n\nLOCATÁRIO: CARLOS EXEMPLO, CPF 000.000.000-00.\n\nCLÁUSULA PRIMEIRA — DO OBJETO\n\nO imóvel está situado na RUA EXEMPLO, 10.\n\nO aluguel será de R$ 4.500,00."),
  {
    title: "Contrato Particular de Locação",
    sections: [{ title: "Partes", startBlockIndex: 0, endBlockIndex: 1 }, { title: "Objeto", startBlockIndex: 2, endBlockIndex: 4 }],
    parties: [{ key: "locatario", label: "Locatário", required: true, description: "Parte locatária" }],
    fields: [
      { label: "Nome do locatário", type: "TEXT", required: true, blockIndex: 1, exactText: "CARLOS EXEMPLO", occurrenceIndex: 0, source: "CLIENT", binding: "client.name", partyKey: "locatario", confidence: 0.98, needsReview: false, rationale: "Nome da parte" },
      { label: "CPF do locatário", type: "CPF_CNPJ", required: true, blockIndex: 1, exactText: "000.000.000-00", occurrenceIndex: 0, source: "CLIENT", binding: "client.cpfCnpj", partyKey: "locatario", confidence: 0.98, needsReview: false, rationale: "Documento da parte" },
      { label: "Endereço do imóvel", type: "TEXT", required: true, blockIndex: 3, exactText: "RUA EXEMPLO, 10", occurrenceIndex: 0, source: "PROPERTY", binding: "property.address", partyKey: "", confidence: 0.96, needsReview: false, rationale: "Imóvel" },
      { label: "Valor do aluguel", type: "CURRENCY", required: true, blockIndex: 4, exactText: "R$ 4.500,00", occurrenceIndex: 0, source: "CONTRACT", binding: "contract.value", partyKey: "", confidence: 0.95, needsReview: false, rationale: "Negociação" },
    ],
    warnings: [],
    partiallyRecognized: false,
  },
)

const largeFieldTokens = Array.from({ length: 36 }, (_, index) => `CAMPO_VARIAVEL_${String(index + 1).padStart(2, "0")}`)
const largeStructure = buildContractTemplateStructure(
  splitContractTextIntoBlocks(`CONTRATO COM MUITOS CAMPOS\n\nCONTRATANTE: ${largeFieldTokens.slice(0, 18).join(" | ")}\n\nCLÁUSULA PRIMEIRA — DADOS COMPLEMENTARES\n\n${largeFieldTokens.slice(18).join(" | ")}`),
  {
    title: "Contrato com muitos campos",
    sections: [
      { title: "Partes", startBlockIndex: 0, endBlockIndex: 1 },
      { title: "Dados complementares", startBlockIndex: 2, endBlockIndex: 3 },
    ],
    parties: [{ key: "contratante", label: "Contratante", required: true, description: "Parte contratante" }],
    fields: largeFieldTokens.map((token, index) => ({
      label: `Campo variável ${index + 1}`,
      type: "TEXT" as const,
      required: index < 10,
      blockIndex: index < 18 ? 1 : 3,
      exactText: token,
      occurrenceIndex: 0,
      source: "CONTRACT" as const,
      binding: "contract.custom" as const,
      partyKey: index < 18 ? "contratante" : "",
      confidence: 0.98,
      needsReview: false,
      rationale: "Campo variável de teste",
    })),
    warnings: [],
    partiallyRecognized: false,
  },
)

const reviewTemplate = {
  id: "template-1",
  name: "Contrato Particular de Locação",
  status: "REVIEW_REQUIRED",
  currentVersion: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: {
    id: "version-1",
    number: 1,
    status: "REVIEW_REQUIRED",
    sourceFileName: "locacao.docx",
    sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sourceFileSize: 34000,
    structure,
    analysisMetadata: { provider: "openai", model: "gpt-5-mini" },
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  },
}

const instance = {
  id: "instance-1",
  brokerDocumentId: "document-1",
  title: "Contrato Particular de Locação — teste",
  status: "draft",
  template: { id: "template-1", name: "Contrato Particular de Locação", version: 1 },
  leadId: null,
  propertyId: null,
  values: Object.fromEntries(structure.fields.map((field) => [field.id, ""])),
  additionalParties: {},
  readiness: calculateContractReadiness(structure, {}),
  html: renderContractTemplateHtml({ structure, values: {}, draft: true }),
  structure,
  signedAt: null,
  signatureNote: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function createPdfFixture() {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const document = new PDFDocument()
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    document.on("end", () => resolve(Buffer.concat(chunks)))
    document.on("error", reject)
    document.fontSize(12).text("CONTRATO PARTICULAR DE LOCAÇÃO. LOCADOR e LOCATÁRIO ajustam o imóvel da Rua Exemplo, valor mensal e prazo conforme este instrumento.")
    document.end()
  })
}

async function createDocxFixture() {
  const zip = new JSZip()
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.folder("_rels")?.file(".rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.folder("word")?.file("document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>CONTRATO PARTICULAR DE COMPRA E VENDA. VENDEDOR e COMPRADOR ajustam preço, imóvel, prazo, condições e assinaturas conforme o conteúdo original deste instrumento.</w:t></w:r></w:p></w:body></w:document>')
  return zip.generateAsync({ type: "nodebuffer" })
}

async function mockContracts(page: Page, initialReady = false) {
  let templateReady = initialReady
  let currentInstance = structuredClone(instance)
  const calls = { templateImports: 0, instanceCreations: 0, reanalyses: 0 }
  await page.route("**/api/brokers/contracts**", (route) => route.fulfill({ json: { contracts: [], contractTypes: [] } }))
  await page.route("**/api/brokers/leads**", (route) => route.fulfill({ json: { leads: [{ id: "lead-1", name: "Carlos Souza", email: "carlos@example.com", phone: "11999999999", whatsApp: "11999999999", identification: { cpfCnpj: "123.456.789-00", rg: "12.345.678-9" }, address: {}, legal: {}, documents: [], completion: { score: 80, pending: [] }, status: "NEW", statusLabel: "Novo", message: "", catalogSlug: "", searchTerm: "", intent: "", source: "Manual", propertyId: null, propertyTitle: "", brokerId: "broker-1", brokerName: "Corretor", agencyId: null, agencyName: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] } }))
  await page.route("**/api/properties/me**", (route) => route.fulfill({ json: { properties: [{ id: "property-1", title: "Apartamento Rua X", formattedPrice: "R$ 700.000,00", location: "Rua X", price: 70000000, city: "São Paulo", neighborhood: "Centro", ownerName: "João", legal: {}, images: [], documents: [], completion: { score: 80, pending: [] } }] } }))
  await page.route("**/api/brokers/me**", (route) => route.fulfill({ json: { profile: { id: "user-1", name: "Corretor", email: "corretor@example.com", phone: "11999999999", brokerId: "broker-1", agencyId: null, accountType: "BROKER", creci: "12345" } } }))
  await page.route("**/api/brokers/financial**", (route) => route.fulfill({ json: { config: { commissionPercent: 6 } } }))
  await page.route("**/api/brokers/contract-templates", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { templates: [{ ...reviewTemplate, status: templateReady ? "READY" : "REVIEW_REQUIRED", version: { ...reviewTemplate.version, status: templateReady ? "READY" : "REVIEW_REQUIRED" } }] } })
    }
    calls.templateImports += 1
    return route.fulfill({ status: 201, json: { template: reviewTemplate, reused: false } })
  })
  await page.route("**/api/brokers/contract-templates/template-1", async (route) => {
    if (route.request().method() === "PATCH") templateReady = true
    return route.fulfill({ json: { template: { ...reviewTemplate, status: "READY", version: { ...reviewTemplate.version, status: "READY" } }, legalTextModified: false } })
  })
  await page.route("**/api/brokers/contract-templates/template-1/reanalyze", (route) => {
    calls.reanalyses += 1
    return route.fulfill({ json: { template: reviewTemplate, reused: false } })
  })
  await page.route("**/api/brokers/contract-instances", (route) => {
    calls.instanceCreations += 1
    return route.fulfill({ status: 201, json: { instance: { id: "instance-1", brokerDocumentId: "document-1" } } })
  })
  await page.route("**/api/brokers/contract-instances/instance-1", async (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({ json: { success: true } })
    }
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON()
      const nextValues = { ...currentInstance.values, ...(payload.values ?? {}) }
      if ("leadId" in payload && (payload.leadId || null) !== (currentInstance.leadId || null)) {
        for (const field of structure.fields) {
          if (field.binding === "client.name") nextValues[field.id] = payload.leadId ? "Carlos Souza" : ""
          if (field.binding === "client.cpfCnpj") nextValues[field.id] = payload.leadId ? "123.456.789-00" : ""
        }
      }
      if ("propertyId" in payload && (payload.propertyId || null) !== (currentInstance.propertyId || null)) {
        for (const field of structure.fields) {
          if (field.binding === "property.address") nextValues[field.id] = payload.propertyId ? "Rua X, Centro, Sao Paulo" : ""
        }
      }
      currentInstance = { ...currentInstance, ...payload, values: nextValues, readiness: calculateContractReadiness(structure, nextValues) }
    }
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON()
      if (payload.action === "sign") {
        currentInstance = { ...currentInstance, status: "signed", signedAt: payload.signedAt, signatureNote: payload.note }
      }
      if (payload.action === "cancel") {
        currentInstance = { ...currentInstance, status: "cancelled", signedAt: null, signatureNote: null }
      }
    }
    return route.fulfill({ json: { instance: currentInstance } })
  })
  return calls
}

test("engine preserva texto fixo, substitui apenas ocorrências e calcula prontidão", () => {
  expect(structure.blocks[2].text).toBe("CLÁUSULA PRIMEIRA — DO OBJETO")
  const values = Object.fromEntries(structure.fields.map((field) => [field.id, `valor-${field.id}`]))
  const html = renderContractTemplateHtml({ structure, values, draft: false })
  expect(html).toContain("CLÁUSULA PRIMEIRA — DO OBJETO")
  expect(html).not.toContain("TEMPLATE OFICIAL EME")
  expect(calculateContractReadiness(structure, values).score).toBe(100)
  expect(calculateContractReadiness(structure, {}).missing).toHaveLength(4)
})

test("bindings hydrate empty values, preserve manual edits and use the binding as source", () => {
  const clientName = structure.fields.find((field) => field.binding === "client.name")!
  const clientDocument = structure.fields.find((field) => field.binding === "client.cpfCnpj")!
  const propertyAddress = structure.fields.find((field) => field.binding === "property.address")!
  const structureWithCorrectedSource = {
    ...structure,
    fields: structure.fields.map((field) => field.id === clientName.id ? { ...field, source: "NONE" as const } : field),
  }
  const context = {
    lead: {
      name: "Carlos Souza",
      email: "carlos@example.com",
      phone: "11999999999",
      whatsapp: "11988888888",
      legalData: { cpfCnpj: "123.456.789-00" },
      addressData: {},
    },
    property: {
      title: "Apartamento Central",
      price: 70000000,
      city: "Sao Paulo",
      neighborhood: "Centro",
      ownerName: "Joao",
      legalData: { street: "Rua X", number: "10", city: "Sao Paulo", state: "SP" },
    },
    broker: {
      user: { name: "Corretor", email: "corretor@example.com", phone: "11977777777" },
      phone: "",
      creci: "12345",
      agency: null,
    },
  }

  const hydrated = mergeKnownContractValues({
    structure: structureWithCorrectedSource,
    currentValues: {
      [clientName.id]: "",
      [clientDocument.id]: "Documento informado manualmente",
      [propertyAddress.id]: "",
    },
    context,
  })

  expect(hydrated[clientName.id]).toBe("Carlos Souza")
  expect(hydrated[clientDocument.id]).toBe("Documento informado manualmente")
  expect(hydrated[propertyAddress.id]).toBe("Rua X, 10, Centro, Sao Paulo - SP")

  const refreshed = mergeKnownContractValues({
    structure: structureWithCorrectedSource,
    currentValues: hydrated,
    context: { ...context, lead: { ...context.lead, name: "Mariana Lopes" } },
    refreshSources: ["CLIENT"],
  })
  expect(refreshed[clientName.id]).toBe("Mariana Lopes")
  expect(refreshed[clientDocument.id]).toBe("123.456.789-00")
  expect(refreshed[propertyAddress.id]).toBe("Rua X, 10, Centro, Sao Paulo - SP")
})

test("additional party keeps manual corrections and clears dependencies when person changes", () => {
  const partyId = structure.parties[0].id
  const additionalField = {
    ...structure.fields[0],
    source: "ADDITIONAL_PARTY" as const,
    binding: "additionalParty.name" as const,
    partyId,
  }
  const additionalStructure = { ...structure, fields: [additionalField] }

  const manual = reconcileAdditionalPartyContractValues({
    structure: additionalStructure,
    storedValues: { [additionalField.id]: "Carlos Souza" },
    incomingValues: { [additionalField.id]: "Carlos de Souza" },
    storedParties: { [partyId]: { leadId: "lead-1", values: {} } },
    incomingParties: { [partyId]: { leadId: "lead-1", values: {} } },
    hasIncomingValues: true,
  })
  expect(manual.additionalParties[partyId].values?.[additionalField.id]).toBe("Carlos de Souza")
  expect(manual.values[additionalField.id]).toBe("Carlos de Souza")

  const switched = reconcileAdditionalPartyContractValues({
    structure: additionalStructure,
    storedValues: manual.values,
    incomingValues: manual.values,
    storedParties: manual.additionalParties,
    incomingParties: { [partyId]: { leadId: "lead-2", values: manual.additionalParties[partyId].values } },
    hasIncomingValues: true,
  })
  expect(switched.additionalParties[partyId]).toEqual({ leadId: "lead-2", values: {} })
  expect(switched.values[additionalField.id]).toBe("")

  const person = {
    name: "Ana Lima",
    email: "ana@example.com",
    phone: "11911111111",
    whatsapp: "11922222222",
    legalData: {
      cpfCnpj: "987.654.321-00",
      rg: "55.444.333-2",
      nationality: "Brasileira",
      profession: "Arquiteta",
      maritalStatus: "Casada",
    },
    addressData: { street: "Rua Y", number: "20", district: "Centro", city: "Curitiba", state: "PR" },
  }
  expect(resolveAdditionalPartyContractBinding("additionalParty.name", person)).toBe("Ana Lima")
  expect(resolveAdditionalPartyContractBinding("additionalParty.phone", person)).toBe("11922222222")
  expect(resolveAdditionalPartyContractBinding("additionalParty.cpfCnpj", person)).toBe("987.654.321-00")
  expect(resolveAdditionalPartyContractBinding("additionalParty.address", person)).toBe("Rua Y, 20, Centro, Curitiba - PR")
})

test("recuperação textual nunca produz folha vazia e divide blocos excessivos sem perder conteúdo", () => {
  const longClause = Array.from({ length: 180 }, (_, index) => `Obrigação ${index + 1} preservada integralmente.`).join(" ")
  const recovered = buildTextOnlyContractTemplateStructure({
    text: `CONTRATO PARTICULAR\n\nCLÁUSULA PRIMEIRA — DO OBJETO. ${longClause}\n\nASSINATURAS`,
    title: "Contrato recuperado",
    warning: "Conteúdo recuperado do original.",
  })
  const html = renderContractTemplateHtml({ structure: recovered, values: {}, draft: true })
  expect(recovered.blocks.length).toBeGreaterThan(3)
  expect(Math.max(...recovered.blocks.map((block) => block.text.length))).toBeLessThanOrEqual(1800)
  expect(recovered.blocks.map((block) => block.text).join(" ")).toContain("Obrigação 180 preservada integralmente.")
  expect(html).toContain("CLÁUSULA PRIMEIRA")
  expect(html).toContain("ASSINATURAS")
  expect(validateContractTemplateOccurrences(recovered)).toEqual([])
  expect(calculateContractReadiness(recovered, {}).score).toBe(0)
  expect(inspectContractTemplateStructure(recovered).hasUsableExtraction).toBe(false)
})

test("modelo só pode ficar READY depois de extrair e confirmar campos e partes válidos", () => {
  const analyzed = inspectContractTemplateStructure(structure)
  expect(analyzed.hasUsableExtraction).toBe(true)
  expect(analyzed.canMarkReady).toBe(false)

  const confirmed = {
    ...structure,
    fields: structure.fields.map((field) => ({ ...field, reviewStatus: "CONFIRMED" as const })),
  }
  expect(inspectContractTemplateStructure(confirmed).canMarkReady).toBe(true)

  const incomplete = normalizeAnalyzedContractTemplateStructure({
    ...buildTextOnlyContractTemplateStructure({ text: "CONTRATO PARTICULAR\n\nTexto jurídico preservado sem campos classificados." }),
    partiallyRecognized: true,
  })
  expect(inspectContractTemplateStructure(incomplete).canMarkReady).toBe(false)
  expect(incomplete.warnings).toContain("A análise não identificou campos variáveis válidos. Reanalise o arquivo antes de utilizar este modelo.")
})

test("alteração estrutural com instâncias cria nova versão e preserva a anterior", () => {
  expect(shouldCreateContractTemplateVersion({ structureChanged: true, currentVersionInstanceCount: 2 })).toBe(true)
  expect(shouldCreateContractTemplateVersion({ structureChanged: false, currentVersionInstanceCount: 2 })).toBe(false)
  expect(shouldCreateContractTemplateVersion({ structureChanged: true, currentVersionInstanceCount: 0 })).toBe(false)
})

test("catálogo de bindings permite revisar todas as origens aceitas pelo schema", () => {
  const available = new Set(contractBindingOptions.map((option) => option.value))
  expect(contractFieldBindingSchema.options.filter((binding) => !available.has(binding))).toEqual([])
})

test("parser lê PDF e DOCX localmente sem provider externo", async () => {
  const pdf = await createPdfFixture()
  const docx = await createDocxFixture()
  const pdfResult = await extractContractTemplateText(new File([pdf], "modelo.pdf", { type: "application/pdf" }))
  const docxResult = await extractContractTemplateText(new File([docx], "modelo.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))
  expect(pdfResult.text).toContain("CONTRATO PARTICULAR DE LOCAÇÃO")
  expect(docxResult.text).toContain("CONTRATO PARTICULAR DE COMPRA E VENDA")
})

test("PDF preserva PT-BR, pagina documentos longos e marca rascunho", async () => {
  const longStructure = {
    ...structure,
    fields: [],
    blocks: Array.from({ length: 48 }, (_, index) => ({
      id: `long-${index}`,
      order: index,
      type: index === 0 ? "TITLE" as const : "PARAGRAPH" as const,
      text: index === 0
        ? "CONTRATO PARTICULAR DE LOCAÇÃO"
        : `CLÁUSULA ${index} — O imóvel, as obrigações, os valores monetários e as condições serão preservados com acentuação em português brasileiro.`,
    })),
  }
  const pdf = await generateContractPdf({ title: "Contrato de locação", draft: true, structure: longStructure, values: {} })
  const { extractText, getDocumentProxy } = await import("unpdf")
  const document = await getDocumentProxy(new Uint8Array(pdf))
  expect(document.numPages).toBeGreaterThan(1)
  const { text } = await extractText(document, { mergePages: true })
  expect(text).toContain("CONTRATO PARTICULAR DE LOCAÇÃO")
  expect(text).toContain("RASCUNHO")
  await document.loadingTask.destroy()
})

test("importação real rejeita arquivo inválido antes de qualquer análise", async ({ page }) => {
  await mockContracts(page, true)
  await loginAsBroker(page)
  await page.unroute("**/api/brokers/contract-templates")
  const response = await page.request.post("/api/brokers/contract-templates", {
    multipart: {
      file: { name: "contrato.txt", mimeType: "text/plain", buffer: Buffer.from("conteúdo inválido") },
    },
  })
  expect(response.status()).toBe(400)
  const data = await response.json()
  expect(data.error).toMatch(/PDF ou DOCX/)
})

test("importa, revisa e reutiliza modelo no novo contrato sem expor modelos EME", async ({ page }) => {
  await loginAsBroker(page)
  const calls = await mockContracts(page)
  await page.goto("/corretor/documentos/contratos")
  await expect(page.getByRole("button", { name: "Importar modelo" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Anexar contrato" })).toBeVisible()
  await page.getByRole("button", { name: "Importar modelo" }).first().click()
  await expect(page.locator('[data-slot="dialog-content"][data-state="open"]')).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await page.locator('input[type="file"]').setInputFiles({ name: "locacao.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("fixture") })
  await page.getByRole("button", { name: "Importar modelo", exact: true }).last().click()
  await expect(page.getByLabel("Nome do modelo")).toBeVisible()
  await expect(page.getByText("4 campos", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /Campos 4/ }).click()
  await expect(page.getByLabel("Nome da parte Locatário")).toBeVisible()
  await expect(page.getByLabel("Preencher com")).toBeVisible()
  await page.getByRole("button", { name: "Salvar modelo" }).click()

  await page.getByRole("button", { name: "Modelos", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Modelos", exact: true })).toBeVisible()
  await expect(page.getByText("Biblioteca reutilizável", { exact: true })).toBeVisible()
  await expect(page.getByText("Contrato Particular de Locação", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Editar modelo", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Editar modelo" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Abrir original" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Documento" })).toBeVisible()
  await page.getByLabel(/Configurar campo Nome do locatário/).click()
  await expect(page.getByTestId("template-field-properties")).toContainText("Nome do locatário")
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Reanalisar", exact: true }).click()
  await expect.poll(() => calls.reanalyses).toBe(1)
  await page.getByRole("button", { name: /Voltar aos modelos/ }).click()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Contratos", exact: true }).click()

  await page.getByRole("button", { name: "Novo contrato" }).click()
  await expect(page.getByText("Compra e venda — Modelo EME")).toHaveCount(0)
  await page.getByRole("button", { name: /Contrato Particular de Locação/ }).click()
  await expect(page.getByText(/Preencher contrato · modelo versão 1/)).toBeVisible()
  await expect(page.getByText("Nome do locatário", { exact: true })).toBeVisible()
  await expect(page.getByText("Valor do aluguel", { exact: true })).toBeVisible()
  await expect(page.getByText("Preview A4 sincronizado")).toBeVisible()
  const previewFrame = page.frameLocator('iframe[title="Preview do contrato"]')
  await expect(previewFrame.getByText("CONTRATO PARTICULAR DE LOCAÇÃO")).toBeVisible()
  await expect(previewFrame.getByText("CLÁUSULA PRIMEIRA — DO OBJETO")).toBeVisible()
  await expect(page.locator('[data-slot="dialog-content"][data-state="open"]')).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await expect(page.getByText("Prontidão", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Trocar modelo" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Gerar PDF final" })).toBeDisabled()

  await expect(page.getByRole("button", { name: "Fechar", exact: true })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Novo contrato" }).click()
  await page.getByRole("button", { name: /Contrato Particular de Locação/ }).click()
  await expect(page.getByText("Preview A4 sincronizado")).toBeVisible()
  expect(calls.templateImports).toBe(1)
  expect(calls.instanceCreations).toBe(2)
  expect(calls.reanalyses).toBe(1)
})

test("editor amplo organiza 35+ campos e mantém seleção contextual sem sobreposição", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await loginAsBroker(page)
  await mockContracts(page, true)
  const largeTemplate = {
    ...reviewTemplate,
    name: "Contrato com muitos campos",
    status: "READY",
    version: { ...reviewTemplate.version, status: "READY", structure: largeStructure },
  }
  await page.route("**/api/brokers/contract-templates", (route) => route.fulfill({ json: { templates: [largeTemplate] } }))
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Modelos", exact: true }).click()
  await page.getByRole("button", { name: "Editar modelo", exact: true }).click()

  const editor = page.getByTestId("contract-template-editor")
  await expect(editor).toBeVisible()
  await expect(page.getByText("36 campos", { exact: true })).toBeVisible()
  await expect(page.getByText("1 parte", { exact: true })).toBeVisible()
  const editorBox = await editor.boundingBox()
  expect(editorBox?.width).toBeGreaterThan(1200)

  await page.getByTestId(`template-field-highlight-${largeStructure.fields[0].id}`).click()
  await expect(page.getByTestId("template-field-properties")).toContainText("Campo variável 1")
  await expect(page.getByLabel("Preencher com")).toBeVisible()

  await page.getByRole("button", { name: /Campos 36/ }).click()
  await expect(page.locator('button[aria-pressed="false"], button[aria-pressed="true"]')).toHaveCount(36)
  await page.getByRole("button", { name: /Campo variável 36/ }).click()
  await expect(page.getByTestId("template-field-properties")).toContainText("Campo variável 36")

  const layout = await page.evaluate(() => {
    const editorElement = document.querySelector('[data-testid="contract-template-editor"]')
    const properties = document.querySelector('[data-testid="template-field-properties"]')
    const editorRect = editorElement?.getBoundingClientRect()
    const propertiesRect = properties?.getBoundingClientRect()
    return {
      bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      propertiesInsideEditor: Boolean(editorRect && propertiesRect && propertiesRect.right <= editorRect.right + 1),
    }
  })
  expect(layout.bodyOverflow).toBeLessThanOrEqual(1)
  expect(layout.propertiesInsideEditor).toBe(true)
})

test("editor de modelo com muitos campos permanece navegável no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAsBroker(page)
  await mockContracts(page, true)
  const largeTemplate = {
    ...reviewTemplate,
    name: "Contrato com muitos campos",
    status: "READY",
    version: { ...reviewTemplate.version, status: "READY", structure: largeStructure },
  }
  await page.route("**/api/brokers/contract-templates", (route) => route.fulfill({ json: { templates: [largeTemplate] } }))
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Modelos", exact: true }).click()
  await page.getByRole("button", { name: "Editar modelo", exact: true }).click()
  await expect(page.getByRole("button", { name: "Documento" })).toBeVisible()
  await page.getByRole("button", { name: /Campos 36/ }).click()
  await page.getByRole("button", { name: /Campo variável 36/ }).click()
  await expect(page.getByTestId("template-field-properties")).toContainText("Campo variável 36")

  const mobileLayout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    editorWidth: document.querySelector('[data-testid="contract-template-editor"]')?.getBoundingClientRect().width ?? 0,
  }))
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth + 1)
  expect(mobileLayout.editorWidth).toBeLessThanOrEqual(390)
})

test("contrato completo registra assinatura externa com data e observação", async ({ page }) => {
  await loginAsBroker(page)
  await mockContracts(page, true)
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Novo contrato" }).click()
  await page.getByRole("button", { name: /Contrato Particular de Locação/ }).click()

  for (const field of structure.fields) {
    await page.locator(`#contract-field-${field.id}`).fill(field.type === "DATE" ? "2026-08-11" : `Valor de ${field.label}`)
  }
  await page.getByRole("button", { name: "Salvar alterações" }).click()
  await expect(page.getByTestId("contract-instance-editor").getByText("100%", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Registrar assinatura" }).click()
  await page.getByLabel("Observação").fill("Assinado presencialmente pelas partes.")
  await page.getByRole("button", { name: "Confirmar" }).click()
  await expect(page.getByRole("button", { name: "Assinatura registrada" })).toBeVisible()
})

test("preenchimento mantém campos estáveis, recolhe após salvar e move o foco pelo painel", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.fulfill({
    json: {
      user: {
        id: "user-1",
        name: "Corretor Teste",
        email: "corretor@example.com",
        role: "BROKER",
        accountType: "BROKER_INDEPENDENT",
        plan: "BROKER",
        subscriptionStatus: "ACTIVE",
        brokerId: "broker-1",
        agencyId: null,
      },
    },
  }))
  await mockContracts(page, true)
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Novo contrato" }).click()
  await page.getByRole("button", { name: /Contrato Particular de Locação/ }).click()

  await expect(page.locator('[data-testid^="contract-field-group-party-"]').getByText("Locatário", { exact: true })).toBeVisible()
  await expect(page.getByTestId("contract-field-group-property").getByText("Imóvel", { exact: true })).toBeVisible()
  await expect(page.getByTestId("contract-field-group-values").getByText("Valores e condições", { exact: true })).toBeVisible()

  const completedField = structure.fields[0]
  const pendingField = structure.fields[1]
  const partyGroup = page.locator('[data-testid^="contract-field-group-party-"]').first()
  const completedInput = page.locator(`#contract-field-${completedField.id}`)
  await completedInput.click()
  const orderBeforeTyping = await partyGroup.locator('[id^="contract-field-"]').evaluateAll((fields) => fields.map((field) => field.id))
  const positionBeforeTyping = await completedInput.evaluate((field) => field.getBoundingClientRect().top)
  await completedInput.pressSequentially("Carlos Souza")
  await expect(completedInput).toBeFocused()
  await expect(page.getByTestId("contract-instance-editor").getByText("25%", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: completedField.label, exact: true })).toHaveCount(0)
  const orderAfterTyping = await partyGroup.locator('[id^="contract-field-"]').evaluateAll((fields) => fields.map((field) => field.id))
  const positionAfterTyping = await completedInput.evaluate((field) => field.getBoundingClientRect().top)
  expect(orderAfterTyping).toEqual(orderBeforeTyping)
  expect(Math.abs(positionAfterTyping - positionBeforeTyping)).toBeLessThan(1)
  await page.getByRole("button", { name: "Salvar alterações" }).click()
  await expect(page.locator(`#contract-field-${completedField.id}`)).toHaveCount(0)
  await expect(page.getByText(/1 campo preenchido recolhido/)).toBeVisible()

  await page.getByRole("button", { name: pendingField.label, exact: true }).click()
  await expect(page.locator(`#contract-field-${pendingField.id}`)).toBeFocused()

  await page.getByRole("button", { name: "Mostrar todos os campos" }).click()
  await expect(page.locator(`#contract-field-${completedField.id}`)).toHaveValue("Carlos Souza")
  await page.getByRole("button", { name: "Mostrar somente em aberto" }).click()
  await expect(page.locator(`#contract-field-${completedField.id}`)).toHaveCount(0)
})

test("selecionar cliente e imovel sincroniza campos e prontidao imediatamente", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.fulfill({
    json: {
      user: {
        id: "user-1",
        name: "Corretor Teste",
        email: "corretor@example.com",
        role: "BROKER",
        accountType: "BROKER_INDEPENDENT",
        plan: "BROKER",
        subscriptionStatus: "ACTIVE",
        brokerId: "broker-1",
        agencyId: null,
      },
    },
  }))
  await mockContracts(page, true)
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Novo contrato" }).click()
  await page.getByRole("button", { name: /Contrato Particular de Locação/ }).click()

  await page.getByRole("combobox").nth(0).selectOption("lead-1")
  await expect(page.getByText("Alterações salvas.")).toBeVisible()
  await page.getByRole("combobox").nth(1).selectOption("property-1")
  await expect(page.getByTestId("contract-instance-editor").getByText("75%", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Mostrar todos os campos" }).click()
  const clientName = structure.fields.find((field) => field.binding === "client.name")!
  const clientDocument = structure.fields.find((field) => field.binding === "client.cpfCnpj")!
  const propertyAddress = structure.fields.find((field) => field.binding === "property.address")!
  await expect(page.locator(`#contract-field-${clientName.id}`)).toHaveValue("Carlos Souza")
  await expect(page.locator(`#contract-field-${clientDocument.id}`)).toHaveValue("123.456.789-00")
  await expect(page.locator(`#contract-field-${propertyAddress.id}`)).toHaveValue("Rua X, Centro, Sao Paulo")
  await expect(page.getByRole("button", { name: "Valor do aluguel", exact: true })).toBeVisible()

  const reopened = await page.evaluate(async () => {
    const response = await fetch("/api/brokers/contract-instances/instance-1", { cache: "no-store" })
    return response.json()
  }) as { instance: typeof instance }
  expect(reopened.instance.readiness.score).toBe(75)
  expect(reopened.instance.values[clientName.id]).toBe("Carlos Souza")
  expect(reopened.instance.values[propertyAddress.id]).toBe("Rua X, Centro, Sao Paulo")
})

test("editor permanece utilizável em PWA sem overflow horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAsBroker(page)
  await mockContracts(page, true)
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Novo contrato" }).click()
  await page.getByRole("button", { name: /Contrato Particular de Locação/ }).click()
  await expect(page.getByText("Preview A4 sincronizado")).toBeVisible()
  await expect(page.locator('[data-slot="dialog-content"][data-state="open"]')).toHaveCSS("background-color", "rgb(255, 255, 255)")
  const mobileLayout = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[data-slot="dialog-content"][data-state="open"]')
    const editor = document.querySelector<HTMLElement>('[data-testid="contract-instance-editor"]')
    const form = document.querySelector<HTMLElement>('[data-testid="contract-editor-form"]')
    const preview = document.querySelector<HTMLElement>('[data-testid="contract-editor-preview"]')
    return {
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      dialogOverflow: Boolean(dialog && dialog.scrollWidth > dialog.clientWidth + 1),
      editorOverflow: Boolean(editor && editor.scrollWidth > editor.clientWidth + 1),
      stacked: Boolean(form && preview && preview.getBoundingClientRect().top >= form.getBoundingClientRect().bottom),
    }
  })
  expect(mobileLayout).toEqual({ documentOverflow: false, dialogOverflow: false, editorOverflow: false, stacked: true })
})

test("editor desktop organiza formulário e A4 em duas colunas sem cortar o preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await loginAsBroker(page)
  await mockContracts(page, true)
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Novo contrato" }).click()
  await page.getByRole("button", { name: /Contrato Particular de Locação/ }).click()
  await expect(page.getByText("Preview A4 sincronizado")).toBeVisible()

  const layout = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[data-slot="dialog-content"][data-state="open"]')
    const form = document.querySelector<HTMLElement>('[data-testid="contract-editor-form"]')
    const preview = document.querySelector<HTMLElement>('[data-testid="contract-editor-preview"]')
    const frame = preview?.querySelector<HTMLIFrameElement>("iframe")
    if (!dialog || !form || !preview || !frame) return null
    const formBox = form.getBoundingClientRect()
    const previewBox = preview.getBoundingClientRect()
    const frameBox = frame.getBoundingClientRect()
    return {
      horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
      sideBySide: previewBox.left > formBox.right,
      a4Ratio: frameBox.width / frameBox.height,
      frameVisible: frameBox.top >= dialog.getBoundingClientRect().top && frameBox.width > 500,
    }
  })
  expect(layout).not.toBeNull()
  expect(layout!.horizontalOverflow).toBe(false)
  expect(layout!.sideBySide).toBe(true)
  expect(layout!.a4Ratio).toBeCloseTo(210 / 297, 2)
  expect(layout!.frameVisible).toBe(true)
})

test("fluxo legado de anexar contrato continua disponível", async ({ page }) => {
  await loginAsBroker(page)
  await mockContracts(page, true)
  await page.goto("/corretor/documentos/contratos")
  await page.getByRole("button", { name: "Anexar contrato" }).first().click()
  await expect(page.getByRole("heading", { name: "Anexar contrato" })).toBeVisible()
  await expect(page.getByText(/Armazene contratos externos/)).toBeVisible()
  await expect(page.locator('input[type="file"]')).toBeVisible()
})
