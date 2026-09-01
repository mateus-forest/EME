export type BrokerPortfolioProperty = {
  id: string
  price: number
  purpose: string
  status: string
  rentalAvailable: boolean
}

export type BrokerPortfolioRental = {
  propertyId: string
  status: string
  monthlyRent: number
}

type PortfolioCategory = {
  count: number
  value: number
  unpricedCount: number
}

function isPaused(status: string) {
  return status.trim().toUpperCase() === "PAUSED"
}

function isRentPurpose(purpose: string) {
  return ["RENT", "RENTAL", "LOCAÇÃO", "LOCACAO", "ALUGUEL"].includes(purpose.trim().toUpperCase())
}

function isActiveRental(status: string) {
  return status.trim().toUpperCase() === "ACTIVE"
}

function category(items: Array<{ amount: number }>): PortfolioCategory {
  return {
    count: items.length,
    value: items.reduce((sum, item) => sum + (Number.isFinite(item.amount) && item.amount > 0 ? item.amount : 0), 0),
    unpricedCount: items.filter((item) => !Number.isFinite(item.amount) || item.amount <= 0).length,
  }
}

export function calculateBrokerPortfolio(
  properties: BrokerPortfolioProperty[],
  rentals: BrokerPortfolioRental[],
) {
  const activeRentalsByProperty = new Map(
    rentals
      .filter((rental) => isActiveRental(rental.status))
      .map((rental) => [rental.propertyId, rental]),
  )
  const activeRentalPropertyIds = new Set(activeRentalsByProperty.keys())
  const activeProperties = properties.filter((property) => !isPaused(property.status))
  const activePropertyIds = new Set([
    ...activeProperties.map((property) => property.id),
    ...activeRentalPropertyIds,
  ])

  const forSaleItems = activeProperties
    .filter((property) => !activeRentalPropertyIds.has(property.id) && !isRentPurpose(property.purpose))
    .map((property) => ({ amount: property.price }))
  const forRentItems = activeProperties
    .filter((property) => (
      !activeRentalPropertyIds.has(property.id) &&
      isRentPurpose(property.purpose) &&
      property.rentalAvailable
    ))
    .map((property) => ({ amount: property.price }))
  const activeRentalItems = [...activeRentalsByProperty.values()].map((rental) => ({ amount: rental.monthlyRent }))

  const forSale = category(forSaleItems)
  const forRent = category(forRentItems)
  const activeRentals = category(activeRentalItems)

  return {
    totalValue: forSale.value + forRent.value + activeRentals.value,
    totalProperties: activePropertyIds.size,
    activeProperties: activePropertyIds.size,
    unpricedProperties: forSale.unpricedCount + forRent.unpricedCount + activeRentals.unpricedCount,
    forSale,
    forRent,
    activeRentals,
  }
}

export type BrokerPortfolio = ReturnType<typeof calculateBrokerPortfolio>
