import { getPropertyImages } from "@/lib/property-media"

export type PublicBrokerCatalogProperty = {
  id: number
  title: string
  location: string
  price: string
  bedrooms: number
  bathrooms: number
  parking: number
  description: string
  images: string[]
  views: number
  interested: number
}

export type PublicBrokerCatalogData = {
  slug: string
  displayName: string
  photoUrl: string
  description: string
  creci: string
  whatsApp: string
  properties: PublicBrokerCatalogProperty[]
}

export type PublicAgencyCatalogProperty = {
  id: number
  title: string
  location: string
  price: string
  bedrooms: number
  bathrooms: number
  parking: number
  status: "Publicado"
  views: number
  leads: number
  image: string
  broker: {
    name: string
    initials: string
  }
}

export type PublicAgencyCatalogData = {
  slug: string
  displayName: string
  logoUrl: string
  description: string
  whatsApp: string
  properties: PublicAgencyCatalogProperty[]
}

const brokerCatalogs: Record<string, PublicBrokerCatalogData> = {
  "joao-corretor": {
    slug: "joao-corretor",
    displayName: "João Silva",
    photoUrl: "",
    description:
      "Especialista em imóveis residenciais na zona sul de São Paulo, com atendimento próximo e foco em conversão rápida.",
    creci: "248761-F",
    whatsApp: "(11) 98888-1111",
    properties: [
      {
        id: 101,
        title: "Apartamento Parque das Flores",
        location: "Moema, São Paulo",
        price: "R$ 980.000",
        bedrooms: 2,
        bathrooms: 2,
        parking: 1,
        description:
          "Apartamento com planta bem distribuída, varanda ensolarada e localização estratégica para quem quer praticidade no dia a dia.",
        images: getPropertyImages(["", ""], 101),
        views: 186,
        interested: 14,
      },
      {
        id: 102,
        title: "Casa Jardim Alto",
        location: "Brooklin, São Paulo",
        price: "R$ 1.780.000",
        bedrooms: 3,
        bathrooms: 4,
        parking: 2,
        description:
          "Casa reformada com ambientes integrados, área gourmet e perfil ideal para famílias que valorizam conforto e mobilidade.",
        images: getPropertyImages(["", "", ""], 102),
        views: 242,
        interested: 19,
      },
    ],
  },
  "maria-santos": {
    slug: "maria-santos",
    displayName: "Marina Costa",
    photoUrl: "",
    description:
      "Especialista em imóveis residenciais e oportunidades exclusivas em Porto Alegre e litoral gaúcho.",
    creci: "123456-F",
    whatsApp: "(11) 99999-9999",
    properties: [
      {
        id: 1,
        title: "Apartamento Vista Parque",
        location: "Jardins, São Paulo",
        price: "R$ 1.280.000",
        bedrooms: 3,
        bathrooms: 2,
        parking: 2,
        description:
          "Apartamento com excelente iluminação natural, varanda agradável e ótima circulação entre os ambientes.",
        images: getPropertyImages(["", "", ""], 1),
        views: 1240,
        interested: 18,
      },
      {
        id: 2,
        title: "Casa Alameda Verde",
        location: "Alphaville, Barueri",
        price: "R$ 3.400.000",
        bedrooms: 4,
        bathrooms: 5,
        parking: 3,
        description:
          "Casa ampla com living integrado, área gourmet e ambientes pensados para conforto no dia a dia.",
        images: getPropertyImages(["", ""], 2),
        views: 980,
        interested: 11,
      },
      {
        id: 4,
        title: "Cobertura Horizonte",
        location: "Vila Nova Conceição, São Paulo",
        price: "R$ 2.950.000",
        bedrooms: 4,
        bathrooms: 4,
        parking: 3,
        description:
          "Cobertura com vista aberta, área social elegante e ótimo potencial de encantamento no primeiro contato.",
        images: getPropertyImages(["", "", ""], 4),
        views: 1860,
        interested: 14,
      },
    ],
  },
}

const agencyCatalogs: Record<string, PublicAgencyCatalogData> = {
  "imobiliaria-x": {
    slug: "imobiliaria-x",
    displayName: "Imobiliária X",
    logoUrl: "",
    description:
      "Curadoria institucional de imóveis residenciais e comerciais com atendimento consultivo e operação ágil.",
    whatsApp: "(11) 97777-2222",
    properties: [
      {
        id: 201,
        title: "Casa Reserva Prime",
        location: "Alphaville, Barueri",
        price: "R$ 2.840.000",
        bedrooms: 4,
        bathrooms: 4,
        parking: 3,
        status: "Publicado",
        views: 418,
        leads: 21,
        image:
          "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&h=800&fit=crop",
        broker: { name: "Marina Costa", initials: "MC" },
      },
      {
        id: 202,
        title: "Apartamento Horizonte Sul",
        location: "Jardins, São Paulo",
        price: "R$ 1.120.000",
        bedrooms: 2,
        bathrooms: 2,
        parking: 1,
        status: "Publicado",
        views: 296,
        leads: 13,
        image:
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop",
        broker: { name: "Rafael Alves", initials: "RA" },
      },
    ],
  },
  "eme-prime": {
    slug: "eme-prime",
    displayName: "EME Prime",
    logoUrl: "",
    description:
      "Imóveis selecionados com curadoria da nossa equipe para quem busca atendimento ágil, confiança e oportunidades de alto valor.",
    whatsApp: "(11) 99999-9999",
    properties: [
      {
        id: 1,
        title: "Casa Alameda Verde",
        location: "Alphaville, Barueri",
        price: "R$ 3.400.000",
        bedrooms: 4,
        bathrooms: 4,
        parking: 2,
        status: "Publicado",
        views: 1842,
        leads: 28,
        image:
          "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&h=800&fit=crop",
        broker: { name: "Marina Costa", initials: "MC" },
      },
      {
        id: 2,
        title: "Apartamento Vista Parque",
        location: "Jardins, São Paulo",
        price: "R$ 1.280.000",
        bedrooms: 2,
        bathrooms: 2,
        parking: 1,
        status: "Publicado",
        views: 1320,
        leads: 18,
        image:
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop",
        broker: { name: "Rafael Alves", initials: "RA" },
      },
    ],
  },
}

export function getMockBrokerCatalogBySlug(slug: string) {
  return brokerCatalogs[slug] ?? null
}

export function getMockAgencyCatalogBySlug(slug: string) {
  return agencyCatalogs[slug] ?? null
}
