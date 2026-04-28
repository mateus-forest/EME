export type DomainUserType = "broker" | "agency" | "admin"

export type DomainPropertyType = "Apartamento" | "Casa" | "Comercial"

export type DomainPropertyStatus = "Publicado" | "Rascunho" | "Pausado"

export type DomainSubscriptionStatus = "Ativo" | "Cancelado"

export type DomainUser = {
  id: number
  nome: string
  email: string
  tipo: DomainUserType
}

export type DomainBroker = {
  id: number
  userId: number
  nome: string
  telefone: string
  imobiliariaId?: number | null
}

export type DomainAgency = {
  id: number
  nome: string
  logo: string
  corretores: number[]
}

export type DomainProperty = {
  id: number
  titulo: string
  preco: string
  tipo: DomainPropertyType
  corretorId: number
  imobiliariaId?: number | null
  status: DomainPropertyStatus
}

export type DomainSubscription = {
  id: number
  ownerId: number
  tipoPlano: string
  status: DomainSubscriptionStatus
  ultimoPagamento: string
  proximaCobranca: string
}

export function deriveUserIdFromEntityId(entityId: number, offset = 1000) {
  return entityId + offset
}
