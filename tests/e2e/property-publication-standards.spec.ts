import { expect, test } from "@playwright/test"

import {
  assessCatalogReadiness,
  assessPropertyPublicationReadiness,
  propertyPublicationBlockedResponse,
  type PropertyImageInspection,
  type PropertyPublicationInput,
} from "@/lib/property-publication-readiness"

const imageUrls = [
  "https://images.example.com/cover.jpg",
  "https://images.example.com/living-room.jpg",
  "https://images.example.com/kitchen.webp",
  "https://images.example.com/bedroom.png",
]

const completeProperty: PropertyPublicationInput = {
  title: "Apartamento completo no Centro",
  description:
    "Apartamento bem iluminado, com ambientes integrados, localização central, acabamento de qualidade e estrutura completa para morar com conforto.",
  price: 850_000_00,
  city: "Porto Alegre",
  neighborhood: "Centro Histórico",
  bedrooms: 2,
  bathrooms: 2,
  parkingSpots: 1,
  type: "APARTMENT",
  purpose: "SALE",
  imageUrls,
  legalData: { privateArea: "85,5" },
  broker: { creciValidationStatus: "VERIFIED" },
}

const validHorizontalImage: PropertyImageInspection = {
  valid: true,
  format: "jpeg",
  width: 1600,
  height: 900,
}

function issueCodes(readiness: Awaited<ReturnType<typeof assessPropertyPublicationReadiness>>) {
  return readiness.marketplace.issues.map((item) => item.code)
}

test.describe("padrão de publicação de imóveis", () => {
  test("imóvel completo fica apto para Catálogo e Marketplace", async () => {
    const readiness = await assessPropertyPublicationReadiness(completeProperty, {
      inspectImage: async () => validHorizontalImage,
    })

    expect(readiness.catalogReady).toBe(true)
    expect(readiness.marketplaceReady).toBe(true)
    expect(readiness.marketplace.issues).toEqual([])
  })

  test("Catálogo permanece independente das regras premium do Marketplace", async () => {
    const property = {
      ...completeProperty,
      description: "",
      imageUrls: [],
      neighborhood: "",
      legalData: {},
      broker: { creciValidationStatus: "PENDING" as const },
    }

    expect(assessCatalogReadiness(property).ready).toBe(true)
    const readiness = await assessPropertyPublicationReadiness(property)
    expect(readiness.catalogReady).toBe(true)
    expect(readiness.marketplaceReady).toBe(false)
    expect(issueCodes(readiness)).toEqual(expect.arrayContaining([
      "NEIGHBORHOOD_REQUIRED",
      "AREA_REQUIRED",
      "DESCRIPTION_TOO_SHORT",
      "MINIMUM_PHOTOS_REQUIRED",
      "CRECI_NOT_VERIFIED",
    ]))
  })

  test("bloqueia imóvel sem fotos ou com poucas fotos", async () => {
    const withoutPhotos = await assessPropertyPublicationReadiness({ ...completeProperty, imageUrls: [] })
    const withFewPhotos = await assessPropertyPublicationReadiness(
      { ...completeProperty, imageUrls: imageUrls.slice(0, 3) },
      { inspectImage: async () => validHorizontalImage },
    )

    expect(issueCodes(withoutPhotos)).toContain("MINIMUM_PHOTOS_REQUIRED")
    expect(issueCodes(withFewPhotos)).toContain("MINIMUM_PHOTOS_REQUIRED")
  })

  test("bloqueia foto principal inválida, formato não suportado e baixa resolução", async () => {
    const inspections: PropertyImageInspection[] = [
      { valid: false, reason: "invalid_url" },
      { valid: false, reason: "unsupported_format", format: "gif" },
      { valid: true, format: "jpeg", width: 800, height: 600 },
      validHorizontalImage,
    ]
    let index = 0
    const readiness = await assessPropertyPublicationReadiness(completeProperty, {
      inspectImage: async () => inspections[index++],
    })

    expect(issueCodes(readiness)).toEqual(expect.arrayContaining([
      "PRIMARY_PHOTO_INVALID",
      "PHOTO_FORMAT_UNSUPPORTED",
      "PHOTO_RESOLUTION_TOO_LOW",
      "MINIMUM_PHOTOS_REQUIRED",
    ]))
  })

  test("exige uma imagem horizontal apta para capa sem impor dimensão exata", async () => {
    const portrait = { valid: true, format: "webp", width: 900, height: 1600 } satisfies PropertyImageInspection
    const withoutCover = await assessPropertyPublicationReadiness(completeProperty, {
      inspectImage: async () => portrait,
    })
    const mixedDimensions = await assessPropertyPublicationReadiness(completeProperty, {
      inspectImage: async (url) => url === imageUrls[0]
        ? { valid: true, format: "jpeg", width: 1800, height: 1200 }
        : portrait,
    })

    expect(issueCodes(withoutCover)).toContain("HORIZONTAL_COVER_REQUIRED")
    expect(mixedDimensions.marketplaceReady).toBe(true)
  })

  test("lista todos os dados obrigatórios ausentes", async () => {
    const readiness = await assessPropertyPublicationReadiness({
      ...completeProperty,
      title: "",
      description: "curta",
      price: 0,
      city: "",
      neighborhood: "",
      bedrooms: 0,
      bathrooms: 0,
      parkingSpots: 0,
      purpose: "",
      legalData: {},
    }, { inspectImage: async () => validHorizontalImage })

    expect(issueCodes(readiness)).toEqual(expect.arrayContaining([
      "TITLE_REQUIRED",
      "PRICE_REQUIRED",
      "CITY_REQUIRED",
      "NEIGHBORHOOD_REQUIRED",
      "AREA_REQUIRED",
      "PURPOSE_REQUIRED",
      "BEDROOMS_REQUIRED",
      "BATHROOMS_REQUIRED",
      "PARKING_REQUIRED",
      "DESCRIPTION_TOO_SHORT",
    ]))
  })

  test("CRECI não verificado bloqueia somente o Marketplace", async () => {
    for (const status of ["PENDING", "REJECTED", "REVIEW_REQUIRED"] as const) {
      const readiness = await assessPropertyPublicationReadiness({
        ...completeProperty,
        broker: { creciValidationStatus: status },
      }, { inspectImage: async () => validHorizontalImage })

      expect(readiness.catalogReady).toBe(true)
      expect(issueCodes(readiness)).toContain("CRECI_NOT_VERIFIED")
      expect(readiness.marketplaceReady).toBe(false)
    }
  })

  test("resposta de bloqueio informa o canal e cada correção necessária", async () => {
    const readiness = await assessPropertyPublicationReadiness({
      ...completeProperty,
      imageUrls: [],
      broker: { creciValidationStatus: "PENDING" },
    })
    const response = propertyPublicationBlockedResponse(readiness, "marketplace")

    expect(response).toMatchObject({
      code: "PROPERTY_NOT_READY",
      channel: "marketplace",
      error: "Este imóvel ainda não atende ao padrão de publicação do EME.",
      channelReadiness: { ready: false },
    })
    expect(response.channelReadiness.issues.map((item) => item.message)).toEqual(expect.arrayContaining([
      "Adicione pelo menos 4 fotos.",
      "Seu CRECI precisa estar verificado.",
    ]))
  })
})
