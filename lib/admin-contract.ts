import type { Agency, Broker, Property, Subscription } from "@/lib/prisma-model-types"
import {
  BrokerAccountStatus,
  SubscriptionStatus,
  UserRole } from "@/lib/prisma-enums"

import type { BillingPlan, BillingUserSubscriptionStatus } from "@/lib/billing-types"

type AdminContractUser = {
  id: string
  name: string
  role: UserRole
  email: string
  phone: string | null
  plan: BillingPlan
  subscriptionStatus: BillingUserSubscriptionStatus
  createdAt: Date
}

export type AdminUserRecord = {
  id: string
  name: string
  type: "Corretor" | "Imobiliária" | "Admin"
  email: string
  whatsApp: string
  status: "Ativo" | "Inativo"
  createdAt: string
  plan: string
}

export type AdminAgencyRecord = {
  id: string
  userId: string
  name: string
  owner: string
  email: string
  whatsApp: string
  status: "Ativa" | "Inativa"
  activeBrokers: number
  publishedProperties: number
  createdAt: string
  plan: string
}

export type AdminBrokerRecord = {
  id: string
  name: string
  initials: string
  creci: string
  email: string
  whatsApp: string
  status: "Ativo" | "Inativo"
  type: "Independente" | "Vinculado"
  agencyName?: string
  plan: string
  propertyCount: number
  activeProperties: number
  leads: number
  aiCreditsBalance: number
  aiCreditsUsedThisMonth: number
  corretorEmeStatus: "Não configurado" | "Em preparação" | "Ativo" | "Pausado"
  corretorEmeUpdatedAt?: string
  createdAt: string
}

export type AdminSubscriptionRecord = {
  id: string
  clientName: string
  ownerType: "broker" | "agency"
  type: "Corretor" | "Imobiliária"
  plan: string
  status: "Ativo" | "Cancelado"
  monthlyValue: number
  startedAt: string
  lastPaymentAt: string
  nextBillingAt: string
  daysOverdue: number
  financialStatus: "Em dia" | "Atraso leve" | "Inadimplente"
  valueOpen?: number
  notificationSent?: boolean
  awaitingRegularization?: boolean
  breakdown?: {
    base: number
    activeBrokers: number
    perBroker: number
    total: number
  }
}

export function deriveInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "AE"
}

export function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("pt-BR").format(value)
}

function formatPlan(plan: BillingPlan, role: UserRole) {
  if (plan === "BROKER") return "Corretor"
  if (plan === "AGENCY") return "Plano Imobiliária"
  if (role === "ADMIN") return "Admin"
  return "Sem plano"
}

function formatCorretorEmeStatus(status?: string | null) {
  if (!status) return "Não configurado"
  if (status === "ACTIVE" || status === "Ativo") return "Ativo"
  if (status === "PAUSED" || status === "Pausado") return "Pausado"
  if (status === "NOT_CONFIGURED" || status === "Não configurado") return "Não configurado"
  return "Em preparação"
}

function mapUserStatus(role: UserRole, brokerStatus?: BrokerAccountStatus, billingStatus?: BillingUserSubscriptionStatus) {
  if (role === "BROKER") {
    return brokerStatus === "INACTIVE" ? "Inativo" : "Ativo"
  }

  if (role === "AGENCY") {
    return billingStatus === "ACTIVE" ? "Ativo" : "Inativo"
  }

  return "Ativo"
}

export function serializeAdminUser(user: AdminContractUser & { broker: Broker | null; ownedAgency: Agency | null }): AdminUserRecord {
  return {
    id: user.id,
    name: user.name,
    type: user.role === "BROKER" ? "Corretor" : user.role === "AGENCY" ? "Imobiliária" : "Admin",
    email: user.email,
    whatsApp: user.phone ?? user.broker?.phone ?? user.ownedAgency?.phone ?? "-",
    status: mapUserStatus(user.role, user.broker?.status, user.subscriptionStatus),
    createdAt: formatDate(user.createdAt),
    plan: formatPlan(user.plan, user.role),
  }
}

export function serializeAdminBroker(
  broker: Broker & {
    user: AdminContractUser
    agency: Agency | null
    corretorEmeConfig: { status: string; updatedAt: Date } | null
    properties: (Pick<Property, "status" | "leadsCount"> & {
      _count?: {
        leads?: number
      }
    })[]
  },
): AdminBrokerRecord {
  return {
    id: broker.id,
    name: broker.user.name,
    initials: deriveInitials(broker.user.name),
    creci: broker.creci ?? "-",
    email: broker.user.email,
    whatsApp: broker.phone,
    status: broker.status === "INACTIVE" ? "Inativo" : "Ativo",
    type: broker.agencyId ? "Vinculado" : "Independente",
    agencyName: broker.agency?.name ?? undefined,
    plan: formatPlan(broker.user.plan, broker.user.role),
    propertyCount: broker.properties.length,
    activeProperties: broker.properties.filter((property) => property.status === "PUBLISHED").length,
    leads: broker.properties.reduce((sum, property) => sum + (property._count?.leads ?? property.leadsCount), 0),
    aiCreditsBalance: broker.aiCreditsBalance,
    aiCreditsUsedThisMonth: broker.aiCreditsUsedThisMonth,
    corretorEmeStatus: formatCorretorEmeStatus(broker.corretorEmeConfig?.status),
    corretorEmeUpdatedAt: broker.corretorEmeConfig ? formatDate(broker.corretorEmeConfig.updatedAt) : undefined,
    createdAt: formatDate(broker.createdAt),
  }
}

export function serializeAdminAgency(
  agency: Agency & {
    ownerUser: AdminContractUser
    brokers: Pick<Broker, "status">[]
    properties: Pick<Property, "status">[]
  },
): AdminAgencyRecord {
  return {
    id: agency.id,
    userId: agency.ownerUserId,
    name: agency.name,
    owner: agency.ownerUser.name,
    email: agency.ownerUser.email,
    whatsApp: agency.phone ?? agency.ownerUser.phone ?? "-",
    status: agency.ownerUser.subscriptionStatus === "ACTIVE" ? "Ativa" : "Inativa",
    activeBrokers: agency.brokers.filter((broker) => broker.status === "ACTIVE").length,
    publishedProperties: agency.properties.filter((property) => property.status === "PUBLISHED").length,
    createdAt: formatDate(agency.createdAt),
    plan: formatPlan(agency.ownerUser.plan, agency.ownerUser.role),
  }
}

function monthlyValueForPlan(plan: BillingPlan) {
  if (plan === "BROKER") return 49.9
  if (plan === "AGENCY") return 109.9
  return 0
}

function mapSubscriptionStatus(status: SubscriptionStatus): "Ativo" | "Cancelado" {
  return status === "CANCELED" ? "Cancelado" : "Ativo"
}

function mapFinancialStatus(status: SubscriptionStatus): "Em dia" | "Atraso leve" | "Inadimplente" {
  if (status === "PAST_DUE") return "Inadimplente"
  return "Em dia"
}

export function serializeAdminSubscription(
  subscription: Subscription,
  owner: AdminContractUser | Agency | null,
  ownerPlan: BillingPlan,
): AdminSubscriptionRecord {
  const ownerType = subscription.ownerType === "AGENCY" ? "agency" : "broker"
  const type = subscription.ownerType === "AGENCY" ? "Imobiliária" : "Corretor"
  const clientName =
    // @ts-ignore Prisma union narrowing for this display-only projection.
    owner && "name" in owner ? owner.name : owner && "ownerUserId" in owner ? owner.name : "Registro não encontrado"

  return {
    id: subscription.id,
    clientName,
    ownerType,
    type,
    plan: subscription.ownerType === "AGENCY" ? "Plano Imobiliária" : "Corretor",
    status: mapSubscriptionStatus(subscription.status),
    monthlyValue: monthlyValueForPlan(ownerPlan),
    startedAt: formatDate(subscription.createdAt),
    lastPaymentAt: formatDate(subscription.createdAt),
    nextBillingAt: formatDate(subscription.nextBillingAt),
    daysOverdue: subscription.status === "PAST_DUE" ? 7 : 0,
    financialStatus: mapFinancialStatus(subscription.status),
    valueOpen: subscription.status === "PAST_DUE" ? monthlyValueForPlan(ownerPlan) : 0,
  }
}
