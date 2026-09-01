import { expect, test } from "@playwright/test"

import { calculateBrokerPortfolio } from "@/lib/broker-portfolio"

test.describe("Financeiro — carteira real do corretor", () => {
  test("inclui imóvel para aluguel ainda não publicado", () => {
    const portfolio = calculateBrokerPortfolio([
      {
        id: "sala-comercial",
        price: 799_900_000,
        purpose: "RENT",
        status: "DRAFT",
        rentalAvailable: true,
      },
    ], [])

    expect(portfolio.totalValue).toBe(799_900_000)
    expect(portfolio.totalProperties).toBe(1)
    expect(portfolio.forRent).toEqual({ count: 1, value: 799_900_000, unpricedCount: 0 })
    expect(portfolio.forSale.count).toBe(0)
    expect(portfolio.activeRentals.count).toBe(0)
  })

  test("classifica venda ativa e exclui imóvel pausado", () => {
    const portfolio = calculateBrokerPortfolio([
      { id: "venda", price: 50_000_000, purpose: "SALE", status: "PUBLISHED", rentalAvailable: true },
      { id: "pausado", price: 90_000_000, purpose: "SALE", status: "PAUSED", rentalAvailable: true },
    ], [])

    expect(portfolio.totalValue).toBe(50_000_000)
    expect(portfolio.totalProperties).toBe(1)
    expect(portfolio.forSale).toEqual({ count: 1, value: 50_000_000, unpricedCount: 0 })
  })

  test("locação ativa vence categorias de venda e disponibilidade sem duplicar o imóvel", () => {
    const portfolio = calculateBrokerPortfolio([
      { id: "alugado", price: 80_000_000, purpose: "RENT", status: "PUBLISHED", rentalAvailable: true },
    ], [
      { propertyId: "alugado", status: "ACTIVE", monthlyRent: 350_000 },
    ])

    expect(portfolio.totalValue).toBe(350_000)
    expect(portfolio.totalProperties).toBe(1)
    expect(portfolio.forRent.count).toBe(0)
    expect(portfolio.forSale.count).toBe(0)
    expect(portfolio.activeRentals).toEqual({ count: 1, value: 350_000, unpricedCount: 0 })
  })

  test("mantém imóveis sem valor nas contagens sem alterar artificialmente o total", () => {
    const portfolio = calculateBrokerPortfolio([
      { id: "venda-sem-valor", price: 0, purpose: "SALE", status: "DRAFT", rentalAvailable: true },
      { id: "aluguel-sem-valor", price: 0, purpose: "RENT", status: "DRAFT", rentalAvailable: true },
    ], [])

    expect(portfolio.totalValue).toBe(0)
    expect(portfolio.totalProperties).toBe(2)
    expect(portfolio.unpricedProperties).toBe(2)
    expect(portfolio.forSale).toEqual({ count: 1, value: 0, unpricedCount: 1 })
    expect(portfolio.forRent).toEqual({ count: 1, value: 0, unpricedCount: 1 })
  })
})
