"use client"

import { useCallback, useEffect, useState } from "react"

import type {
  AdminAgencyRecord,
  AdminBrokerRecord,
  AdminSubscriptionRecord,
  AdminUserRecord,
} from "@/lib/admin-contract"
import { deriveInitials, formatCurrencyBRL } from "@/lib/admin-contract"

export type {
  AdminAgencyRecord,
  AdminBrokerRecord,
  AdminSubscriptionRecord,
  AdminUserRecord,
} from "@/lib/admin-contract"

async function parseAdminResponse<T>(response: Response, key: string) {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string
        [key: string]: T[] | string | undefined
      }
    | null

  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível carregar os dados administrativos.")
  }

  return (data?.[key] as T[] | undefined) ?? []
}

async function parseAdminItemResponse<T>(response: Response, key: string) {
  const data = (await response.json().catch(() => null)) as
    | {
        deleted?: boolean
        error?: string
        [key: string]: T | string | boolean | undefined
      }
    | null

  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível concluir a ação administrativa.")
  }

  return {
    deleted: Boolean(data?.deleted),
    item: data?.[key] as T | undefined,
  }
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
  }
}

function useAdminList<T>(url: string, key: string) {
  const [items, setItems] = useState<T[]>([])

  const refresh = useCallback(async () => {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })

    const nextItems = await parseAdminResponse<T>(response, key)
    setItems(nextItems)
  }, [key, url])

  useEffect(() => {
    refresh().catch(() => {
      setItems([])
    })
  }, [refresh])

  return [items, setItems] as const
}

export function calculateAgencyMonthlyValue(_activeBrokers?: number) {
  return 109.9
}

export { formatCurrencyBRL, deriveInitials }

export function clearAdminMockStorage() {
  // legado removido: área admin agora usa apenas dados persistidos.
}

export function useAdminUsers() {
  return useAdminList<AdminUserRecord>("/api/admin/users", "users")
}

export function useAdminAgencies() {
  return useAdminList<AdminAgencyRecord>("/api/admin/agencies", "agencies")
}

export function useAdminBrokers() {
  return useAdminList<AdminBrokerRecord>("/api/admin/brokers", "brokers")
}

export function useAdminSubscriptions() {
  return useAdminList<AdminSubscriptionRecord>("/api/admin/subscriptions", "subscriptions")
}

export async function updateAdminUser(id: string, updates: Partial<AdminUserRecord>) {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(updates),
  })

  const { item } = await parseAdminItemResponse<AdminUserRecord>(response, "user")
  if (!item) throw new Error("Não foi possível sincronizar o usuário.")
  return item
}

export async function deleteAdminUser(id: string) {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  })

  return parseAdminItemResponse<AdminUserRecord>(response, "user")
}

export async function updateAdminBroker(id: string, updates: Partial<AdminBrokerRecord>) {
  const response = await fetch(`/api/admin/brokers/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(updates),
  })

  const { item } = await parseAdminItemResponse<AdminBrokerRecord>(response, "broker")
  if (!item) throw new Error("Não foi possível sincronizar o corretor.")
  return item
}

export async function deleteAdminBroker(id: string) {
  const response = await fetch(`/api/admin/brokers/${id}`, {
    method: "DELETE",
    credentials: "include",
  })

  return parseAdminItemResponse<AdminBrokerRecord>(response, "broker")
}

export async function updateAdminAgency(id: string, updates: Partial<AdminAgencyRecord>) {
  const response = await fetch(`/api/admin/agencies/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(updates),
  })

  const { item } = await parseAdminItemResponse<AdminAgencyRecord>(response, "agency")
  if (!item) throw new Error("Não foi possível sincronizar a imobiliária.")
  return item
}

export async function deleteAdminAgency(id: string) {
  const response = await fetch(`/api/admin/agencies/${id}`, {
    method: "DELETE",
    credentials: "include",
  })

  return parseAdminItemResponse<AdminAgencyRecord>(response, "agency")
}

export async function updateAdminSubscription(id: string, updates: Partial<AdminSubscriptionRecord>) {
  const response = await fetch(`/api/admin/subscriptions/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(updates),
  })

  const { item } = await parseAdminItemResponse<AdminSubscriptionRecord>(response, "subscription")
  if (!item) throw new Error("Não foi possível sincronizar a assinatura.")
  return item
}

export async function notifyAdminSubscription(id: string) {
  const response = await fetch(`/api/admin/subscriptions/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ action: "notify" }),
  })

  const { item } = await parseAdminItemResponse<AdminSubscriptionRecord>(response, "subscription")
  if (!item) throw new Error("Não foi possível registrar a notificação.")
  return item
}
