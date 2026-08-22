export type AdminCatalogRow = {
  brokerId: string
  userId: string
  brokerName: string
  brokerEmail: string
  slug: string
  publicPath: string
  status: "Ativo" | "Inativo" | "Atenção"
  creci: string
  creciStatus: string
  publishedProperties: number
  views: number
  contacts: number
  shares: number | null
  conversion: number | null
  updatedAt: string
  issue: string | null
}

export type AdminCatalogsReport = {
  generatedAt: string
  overview: {
    total: number
    active: number
    inactive: number
    attention: number
    views: number
    contacts: number
    shares: number | null
  }
  catalogs: AdminCatalogRow[]
  topAccessed: AdminCatalogRow[]
  topConversion: AdminCatalogRow[]
  growth: Array<{ label: string; value: number }>
  coverage: Array<{ domain: string; status: "Coberto" | "Parcial"; detail: string }>
}
