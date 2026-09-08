import { expect, test } from "@playwright/test"

import {
  assessCatalogReadiness,
  assessPropertyPublicationReadiness,
  inspectPropertyPublicationImage,
  propertyPublicationBlockedResponse,
  type PropertyImageInspection,
  type PropertyPublicationInput,
} from "@/lib/property-publication-readiness"
import { createServer } from "node:http"
import sharp from "sharp"
import { describePropertyImage, MARKETPLACE_COVER_REQUIREMENT } from "@/lib/property-image-requirements"

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
  test("capa quadrada 1600×1600 com quatro verticais passa sem mudar exigências da galeria", async () => {
    const readiness = await assessPropertyPublicationReadiness({ ...completeProperty, imageUrls: [...imageUrls, "https://images.example.com/fifth.jpg"] }, {
      inspectImage: async (url) => ({ valid: true, format: "jpeg", width: url === imageUrls[0] ? 1600 : 1200, height: 1600 }),
    })
    expect(issueCodes(readiness)).toEqual([])
    expect(readiness.marketplaceReady).toBe(true)
    expect(readiness.marketplace.photos).toHaveLength(5)
    expect(readiness.marketplace.photos?.[0].message).toContain("1600 × 1600 px · quadrada")
    expect(readiness.marketplace.photos?.[1].message).toContain("1200 × 1600 px · vertical")
    expect(readiness.marketplace.photos?.map((photo) => photo.coverEligible)).toEqual([true, false, false, false, false])
    expect(readiness.marketplace.photos?.[0].message).toContain("Apta para capa")
  })

  for (const [width, height, eligible] of [[1600,1600,true], [1200,1200,true], [1600,900,true], [1200,675,true], [900,1200,false], [800,800,false]] as const) {
    test(`regra global de capa: ${width}×${height} → ${eligible}`, async () => {
      const details = describePropertyImage(width, height)
      expect(details.coverEligible).toBe(eligible)
      const readiness = await assessPropertyPublicationReadiness(completeProperty, {
        inspectImage: async () => ({ valid: true, format: "jpeg", width, height }),
      })
      expect(readiness.marketplaceReady).toBe(eligible)
      expect(issueCodes(readiness).includes("HORIZONTAL_COVER_REQUIRED")).toBe(!eligible)
      expect(issueCodes(readiness).includes("PHOTO_RESOLUTION_TOO_LOW")).toBe(width === 800)
    })
  }

  test("mensagem de capa informa a nova regra sem alterar os limites da galeria", () => {
    expect(MARKETPLACE_COVER_REQUIREMENT).toBe("Para a capa, use uma foto horizontal ou quadrada com no mínimo 1200×675 px.")
  })

  test("uma única horizontal válida basta, mesmo fora da primeira posição", async () => {
    const readiness = await assessPropertyPublicationReadiness(completeProperty, {
      inspectImage: async (url) => ({ valid: true, format: "jpeg", width: 1200, height: url === imageUrls[3] ? 675 : 1600 }),
    })
    expect(readiness.marketplaceReady).toBe(true)
    expect(readiness.marketplace.photos?.map((photo) => photo.coverEligible)).toEqual([false, false, false, true])
  })

  test("foto pequena informa dimensão real sem relaxar o mínimo", async () => {
    const readiness = await assessPropertyPublicationReadiness(completeProperty, {
      inspectImage: async () => ({ valid: true, format: "jpeg", width: 1199, height: 674 }),
    })
    expect(issueCodes(readiness).filter((code) => code === "PHOTO_RESOLUTION_TOO_LOW")).toHaveLength(4)
    expect(readiness.marketplace.issues[0].message).toContain("1199 × 674 px")
    expect(readiness.marketplace.issues[0].message).toContain("lado maior de pelo menos 1200 px")
    expect(readiness.marketplaceReady).toBe(false)
  })

  test("falha de leitura não é apresentada como prova de foto vertical ou pequena", async () => {
    const readiness = await assessPropertyPublicationReadiness(completeProperty, {
      inspectImage: async () => ({ valid: false, reason: "unreachable" }),
    })
    expect(readiness.marketplace.issues[0].message).toContain("não pôde ser carregada")
    expect(readiness.marketplace.issues.find((item) => item.code === "HORIZONTAL_COVER_REQUIRED")?.message).toContain("Não foi possível confirmar")
    expect(readiness.marketplace.photos?.every((photo) => photo.width === undefined)).toBe(true)
  })

  test("inspeção lê bytes originais e respeita orientação EXIF antes de validar capa", async () => {
    const horizontal = await sharp({ create: { width: 1200, height: 675, channels: 3, background: "#ddd" } }).jpeg().toBuffer()
    const rotated = await sharp({ create: { width: 1200, height: 675, channels: 3, background: "#ddd" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const server = createServer((request, response) => {
      response.setHeader("Content-Type", "image/jpeg")
      response.end(request.url === "/rotated.jpg" ? rotated : horizontal)
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address() as { port: number }
    const baseUrl = `http://127.0.0.1:${address.port}`
    try {
      expect(await inspectPropertyPublicationImage("/original.jpg", { baseUrl })).toMatchObject({ valid: true, width: 1200, height: 675 })
      expect(await inspectPropertyPublicationImage("/rotated.jpg", { baseUrl })).toMatchObject({ valid: true, width: 675, height: 1200 })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

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
      broker: { creciValidationStatus: "VERIFIED" as const },
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

  test("rejeita galeria só de verticais e aceita capa horizontal sem impor proporção exata", async () => {
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

  test("CRECI não verificado bloqueia Catálogo e Marketplace sem herdar exigências premium", async () => {
    for (const status of ["PENDING", "REJECTED", "REVIEW_REQUIRED"] as const) {
      const property = {
        ...completeProperty,
        description: "",
        imageUrls: [],
        neighborhood: "",
        legalData: {},
        broker: { creciValidationStatus: status },
      }
      const catalogReadiness = assessCatalogReadiness(property)
      const readiness = await assessPropertyPublicationReadiness(property)

      expect(catalogReadiness.ready).toBe(false)
      expect(catalogReadiness.issues.map((item) => item.code)).toEqual(["CRECI_NOT_VERIFIED"])
      expect(readiness.catalogReady).toBe(false)
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
