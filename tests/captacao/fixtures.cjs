// Synthetic provider responses for automated tests only. Never imported by the app.
const urls = {
  chavesnamao:
    "https://www.chavesnamao.com.br/imovel/apartamento-a-venda-sp-sao-paulo-centro/id-991100/",
  vivareal:
    "https://www.vivareal.com.br/imovel/apartamento-centro-sao-paulo-venda-id-991100/",
  zap: "https://www.zapimoveis.com.br/imovel/venda-apartamento-centro-sao-paulo-id-991100/",
  olx: "https://sp.olx.com.br/sao-paulo/imoveis/apartamento-a-venda-991100",
}
const address = {
  city: "São Paulo",
  state: "SP",
  stateAcronym: "SP",
  neighborhood: "Centro",
  street: "Rua de Teste, 100",
}
const base = {
  id: "991100",
  title: "FIXTURE · Apartamento à venda no Centro",
  description: "Descrição sintética para testes. Não é um anúncio real.",
  businessType: "sale",
  address,
  createdAt: "2026-09-01T12:00:00Z",
}
const items = {
  chavesnamao: {
    ...base,
    url: urls.chavesnamao,
    realtyType: { name: "Apartamento" },
    prices: { rawPrice: 500000 },
    area: { useful: 70 },
    counts: { bedrooms: { count: 2 }, garages: { count: 1 } },
    advertiser: {
      type: "PF",
      name: "Anunciante de teste",
      phones: { cellphone: "(11) 99999-1234", public: true },
    },
  },
  vivareal: {
    ...base,
    url: urls.vivareal,
    unitTypes: ["APARTMENT"],
    contractType: "OWNER",
    prices: [{ businessType: "sale", value: 500000 }],
    attributes: { usableAreas: [70], bedrooms: [2], parkingSpaces: [1] },
    advertiser: { name: "Anunciante de teste", phoneNumbers: [] },
  },
  zap: {
    ...base,
    url: urls.zap,
    business: "SALE",
    prices: { mainValue: 500000 },
    advertiser: { name: "Anunciante de teste" },
  },
  olx: {
    ...base,
    url: urls.olx,
    price: 500000,
    listedAt: "2026-09-01T12:00:00Z",
    location: address,
    professionalAd: false,
    properties: [
      { name: "rooms", label: "Quartos", value: "2" },
      { name: "size", label: "Área", value: "70" },
      { name: "garage", label: "Vagas", value: "1" },
    ],
    seller: { nameHash: "a".repeat(64) },
    phoneHashes: ["b".repeat(64)],
  },
}
const domains = {
  chavesnamao: "chavesnamao.com.br",
  vivareal: "vivareal.com.br",
  zap: "zapimoveis.com.br",
  olx: "olx.com.br",
}
function response(source, page = 1) {
  return {
    requestId: "fixture-request",
    data: {
      source: domains[source],
      type: "plp",
      page,
      nextPage: page === 1 ? 2 : null,
      items: [
        {
          ...items[source],
          id: page === 1 ? "991100" : "991101",
          url: urls[source].replace("991100", page === 1 ? "991100" : "991101"),
        },
      ],
    },
  }
}
module.exports = {
  urls,
  items,
  response,
  filters: {
    state: "SP",
    city: "São Paulo",
    neighborhoods: ["Centro"],
    businessType: "sale",
    advertiser: "any",
    priceMin: 400000,
    priceMax: 600000,
  },
}
