"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { billingPlanLabel } from "@/lib/billing-resolution"
import type { AdminStripeBillingReport } from "@/lib/admin-stripe-billing-contract"

const timestamp = (value: Date | string | null | undefined) => value
  ? new Date(value instanceof Date ? value.getTime() : value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Não disponível"

export function AdminStripeBillingCheck({ userId, onVerified }: { userId: string; onVerified?: (report: AdminStripeBillingReport) => void }) {
  const [report, setReport] = useState<AdminStripeBillingReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function verify() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/billing`, { cache: "no-store", signal: controller.signal })
      const payload = await response.json()
      if (!response.ok || payload.userId !== userId || !payload.evidence || !payload.resolution) throw new Error(payload.error || "Resposta de verificação inválida.")
      if (controller.signal.aborted) return
      setReport(payload)
      onVerified?.(payload)
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Falha ao verificar Stripe.")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const snapshot = report?.evidence.snapshot
  const stripePlan = report?.evidence.items.find((item) => item.priceId === snapshot?.priceId)?.plan ?? null
  return (
    <div className="mb-4 min-w-0 rounded-xl border border-slate-200 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">Comparação com Stripe</p>
          <p className="mt-1 text-xs text-slate-500">Somente leitura. Nenhum plano, acesso ou registro será alterado.</p>
        </div>
        <Button type="button" variant="outline" disabled={loading} onClick={() => void verify()}>{loading ? "Verificando…" : "Verificar Stripe"}</Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-red-700">Pendente de conciliação: {error}</p> : null}
      {report ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          <p className={report.resolution.presentationStatus === "Pendente de conciliação" ? "font-semibold text-amber-800" : "font-semibold text-slate-900"}>
            {report.resolution.presentationStatus}
          </p>
          <p className="text-xs text-slate-500">Última verificação: {timestamp(report.evidence.checkedAt)} (Brasília). {report.evidence.status === "not_needed" ? "Sem vínculos locais; Stripe não consultado." : report.evidence.status === "unavailable" ? "Consulta não concluída." : "Observação desta consulta; não persistida."}</p>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2 [&_dd]:mt-1 [&_dd]:break-words [&_dt]:text-xs [&_dt]:text-slate-500">
            <div><dt>Plano local / acesso registrado</dt><dd>{billingPlanLabel(report.localResolution.contractedPlan)} / {billingPlanLabel(report.localResolution.effectivePlan)}</dd></div>
            <div><dt>Plano Stripe pelo Price</dt><dd>{stripePlan ? billingPlanLabel(stripePlan) : "Não confirmado"}</dd></div>
            <div><dt>Status local</dt><dd>{report.local.subscriptionStatus ?? "Sem Subscription"} · User: {report.local.userStatus}</dd></div>
            <div><dt>Status original Stripe</dt><dd>{snapshot?.status ?? "Não confirmado; veja as assinaturas observadas abaixo"}</dd></div>
            <div><dt>Customer local / Stripe</dt><dd>{report.local.customerId ?? "Sem vínculo"} / {report.evidence.customer?.id ?? "Não encontrado"}{report.evidence.customer?.deleted ? " (excluído)" : ""}</dd></div>
            <div><dt>Subscription local / Stripe</dt><dd>{report.local.subscriptionId ?? report.local.accountSubscriptionId ?? "Sem vínculo"} / {snapshot?.id ?? "Sem correspondência confirmada"}</dd></div>
            <div><dt>Período do plano Stripe</dt><dd>{timestamp(snapshot?.currentPeriodStart)} → {timestamp(snapshot?.currentPeriodEnd)}</dd></div>
            <div><dt>Trial Stripe</dt><dd>{timestamp(snapshot?.trialStart)} → {timestamp(snapshot?.trialEnd)}</dd></div>
            <div><dt>Cancelamento no fim do período</dt><dd>{snapshot ? snapshot.cancelAtPeriodEnd ? "Sim" : "Não" : "Não confirmado"}</dd></div>
            <div><dt>Cancelamento registrado no Stripe</dt><dd>{timestamp(snapshot?.canceledAt)}</dd></div>
          </dl>
          {report.resolution.conflicts.length ? (
            <ul className="list-disc space-y-1 rounded-lg bg-amber-50 py-3 pl-7 pr-3 text-xs text-amber-900">
              {report.resolution.conflicts.map((conflict, index) => <li key={`${conflict.code}-${index}`}>{conflict.message}</li>)}
            </ul>
          ) : <p className="text-xs text-slate-600">Sem divergências detectadas nas evidências disponíveis.</p>}
          <details className="min-w-0 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">Evidência consultada</summary>
            <p className="mt-2 break-words">User.plan: {report.local.userPlan} · BrokerPlanAccount: {report.local.accountPlan ?? "ausente"}</p>
            {report.evidence.subscriptions.map((subscription) => <p key={subscription.id} className="mt-2 break-words">{subscription.id} · {subscription.status} · {subscription.livemode ? "live" : "test"}</p>)}
            {report.evidence.items.map((item) => <p key={item.id} className="mt-2 break-words">{item.id} · {item.priceId} · {item.kind === "plan" ? "plano" : item.kind === "addon" ? "adicional" : "Price desconhecido"} · quantidade {item.quantity ?? "não informada"}</p>)}
            {[...report.evidence.limitations, ...report.resolution.limitations].map((limitation) => <p key={limitation} className="mt-2">{limitation}</p>)}
          </details>
        </div>
      ) : null}
    </div>
  )
}
