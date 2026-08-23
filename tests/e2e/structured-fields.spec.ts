import { expect, test } from "@playwright/test"
import { loginAsBroker } from "./helpers/auth"

import {
  formatArea,
  formatCep,
  formatCnpj,
  formatCpf,
  formatCpfCnpj,
  formatCurrencyBRLFromCents,
  formatCurrencyInput,
  formatDateBR,
  formatDecimalInput,
  formatPercentInput,
  formatPhone,
  formatQuantityInput,
  formatRg,
  isValidBrazilianDate,
  isValidCnpj,
  isValidCpf,
  isValidPhone,
  normalizeCep,
  normalizeCpfCnpj,
  normalizePhone,
  parseBrazilianDateToIso,
  parseCurrencyInputToCents,
  parseDecimalInput,
  parsePercentInput,
  parseQuantity,
} from "@/lib/structured-fields"

test.describe("formatadores e parsers estruturados", () => {
  test("moeda BRL mantém centavos normalizados e aceita digitação, colagem e reabertura", () => {
    expect(formatCurrencyInput("5")).toBe("R$ 5,00")
    expect(formatCurrencyInput("5000")).toBe("R$ 5.000,00")
    expect(formatCurrencyInput("500000")).toBe("R$ 500.000,00")
    expect(parseCurrencyInputToCents("R$ 500.000,00")).toBe(50_000_000)
    expect(formatCurrencyBRLFromCents(50_000_000)).toBe("R$ 500.000,00")
    expect(formatCurrencyInput("")).toBe("")
  })

  test("CPF e CNPJ compartilham máscara progressiva e normalização", () => {
    expect(formatCpf("12345678900")).toBe("123.456.789-00")
    expect(formatCnpj("12345678000199")).toBe("12.345.678/0001-99")
    expect(formatCpfCnpj("12345678900")).toBe("123.456.789-00")
    expect(formatCpfCnpj("12345678000199")).toBe("12.345.678/0001-99")
    expect(normalizeCpfCnpj("12.345.678/0001-99")).toBe("12345678000199")
    expect(isValidCpf("529.982.247-25")).toBe(true)
    expect(isValidCpf("123.456.789-00")).toBe(false)
    expect(isValidCnpj("04.252.011/0001-10")).toBe(true)
  })

  test("telefone e CEP aceitam valores crus ou já formatados", () => {
    expect(formatPhone("54999999999")).toBe("(54) 99999-9999")
    expect(formatPhone("5433334444")).toBe("(54) 3333-4444")
    expect(normalizePhone("(54) 99999-9999")).toBe("54999999999")
    expect(normalizePhone("+55 (54) 99999-9999")).toBe("54999999999")
    expect(isValidPhone("(54) 99999-9999")).toBe(true)
    expect(formatCep("95200000")).toBe("95200-000")
    expect(normalizeCep("95200-000")).toBe("95200000")
  })

  test("datas válidas convertem entre DD/MM/AAAA e ISO sem deslocamento de fuso", () => {
    expect(parseBrazilianDateToIso("29/02/2024")).toBe("2024-02-29")
    expect(parseBrazilianDateToIso("31/02/2024")).toBeNull()
    expect(isValidBrazilianDate("31/02/2024")).toBe(false)
    expect(formatDateBR("2026-08-14")).toBe("14/08/2026")
    expect(formatDateBR("14/08/2026")).toBe("14/08/2026")
  })

  test("percentual, área, decimal e quantidade não misturam apresentação com parsing", () => {
    expect(formatPercentInput("5")).toBe("5%")
    expect(formatPercentInput("5,5")).toBe("5,5%")
    expect(parsePercentInput("105%")).toBe(100)
    expect(formatArea("140")).toBe("140 m²")
    expect(formatDecimalInput("140,25 m²")).toBe("140,25")
    expect(parseDecimalInput("1.140,25 m²")).toBe(1140.25)
    expect(formatQuantityInput("3 quartos")).toBe("3")
    expect(parseQuantity("-2")).toBe(2)
  })

  test("RG permanece permissivo por não haver máscara nacional única", () => {
    expect(formatRg("12.345.678-X")).toBe("12.345.678-X")
    expect(formatRg("MG-12 345 678")).toBe("MG-12 345 678")
  })
})

test("campo monetário do Marketplace mascara colagem, backspace e limpeza", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/imoveis")
  await page.getByRole("button", { name: "Explorar por filtros" }).click()
  const input = page.getByRole("dialog", { name: "Explorar por filtros" }).getByLabel(/mínimo$/i)

  await expect(input).toHaveAttribute("inputmode", "numeric")
  await input.fill("500000")
  await expect(input).toHaveValue(/R\$\s*500\.000,00/)

  await input.press("End")
  await input.press("Backspace")
  await expect(input).toHaveValue(/R\$\s*50\.000,00/)

  await input.fill("")
  await expect(input).toHaveValue("")
})

test("novo cliente aplica CPF/CNPJ, telefone, data e CEP durante a digitação", async ({ page }) => {
  await loginAsBroker(page)
  await page.route("**/api/brokers/leads**", (route) => route.fulfill({ json: { leads: [] } }))
  await page.route("**/api/properties/me**", (route) => route.fulfill({ json: { properties: [] } }))
  await page.goto("/corretor/clientes")
  await page.getByRole("button", { name: "Novo cliente" }).click()

  const dialog = page.getByRole("dialog")
  const documentInput = dialog.getByLabel("CPF ou CNPJ")
  const phoneInput = dialog.getByLabel("Telefone")
  const dateInput = dialog.getByLabel("Data de emissão")
  const cepInput = dialog.getByLabel("CEP")

  await documentInput.fill("12345678000199")
  await expect(documentInput).toHaveValue("12.345.678/0001-99")
  await phoneInput.fill("54999999999")
  await expect(phoneInput).toHaveValue("(54) 99999-9999")
  await dateInput.fill("14082026")
  await expect(dateInput).toHaveValue("14/08/2026")
  await cepInput.fill("95200000")
  await expect(cepInput).toHaveValue("95200-000")
})
