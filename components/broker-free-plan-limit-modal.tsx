"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type BrokerFreePlanLimitModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type BrokerPlanModalSnapshot = {
  currentPlan: {
    key: string
    name: string
    propertyLimit: number
  }
  propertyLimits: {
    totalLimit: number
    used: number
    extraLimit: number
    isExpansionActive: boolean
  }
}

function isBrokerPlanModalSnapshot(value: unknown): value is BrokerPlanModalSnapshot {
  return Boolean(value && typeof value === "object" && "currentPlan" in value && "propertyLimits" in value)
}

function getPlanDisplayName(planName: string | undefined) {
  if (!planName) return "seu plano atual"
  return planName.replace(/^Plano EME\s+/i, "").replace(/^Plano\s+/i, "").trim()
}

export function BrokerFreePlanLimitModal({
  open,
  onOpenChange,
}: BrokerFreePlanLimitModalProps) {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<BrokerPlanModalSnapshot | null>(null)

  useEffect(() => {
    if (!open) return

    let active = true

    async function loadSnapshot() {
      try {
        const response = await fetch("/api/brokers/plan", {
          credentials: "include",
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as unknown

        if (!active) return
        if (!response.ok || !isBrokerPlanModalSnapshot(data)) {
          setSnapshot(null)
          return
        }

        setSnapshot(data)
      } catch {
        if (active) {
          setSnapshot(null)
        }
      }
    }

    void loadSnapshot()

    return () => {
      active = false
    }
  }, [open])

  function handleUpgradeClick() {
    onOpenChange(false)
    router.push("/corretor/plano")
  }

  const planName = getPlanDisplayName(snapshot?.currentPlan.name)
  const propertyLimit = snapshot?.propertyLimits.totalLimit ?? snapshot?.currentPlan.propertyLimit ?? 5
  const usedProperties = snapshot?.propertyLimits.used ?? propertyLimit
  const hasExpansion = Boolean(snapshot?.propertyLimits.extraLimit && snapshot.propertyLimits.isExpansionActive)

  const benefits = [
    `Aumentar o limite de imóveis ativos${hasExpansion ? " do plano e da expansão atual" : ""}`,
    "Acompanhar Créditos IA e consumo da operação em um só lugar",
    "Adicionar Expansão da Carteira quando precisar de mais capacidade",
    "Comparar Free, Pro e Scale antes de decidir o próximo passo",
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.85rem] border-black/[0.06] bg-white/95 p-0 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-[34rem]">
        <DialogHeader className="border-b border-black/[0.05] px-6 py-6 sm:px-7">
          <div className="inline-flex w-fit rounded-full border border-black/[0.06] bg-[#f7f8f5] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6B7280]">
            Limite do plano
          </div>
          <DialogTitle className="mt-4 text-[1.75rem] leading-tight text-[#050505]">
            Você atingiu o limite do seu plano
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm leading-7 text-[#5F6B7A] sm:text-[15px]">
            Você já atingiu o número máximo de imóveis ativos permitido no plano {planName}. Hoje sua operação está usando{" "}
            <span className="font-semibold text-[#050505]">{usedProperties}</span> de{" "}
            <span className="font-semibold text-[#050505]">{propertyLimit}</span> imóveis disponíveis.
            Abra a página Plano para continuar publicando com upgrade ou Expansão da Carteira.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6 sm:px-7">
          <div className="rounded-[1.4rem] border border-[#009b3a]/12 bg-[linear-gradient(180deg,rgba(0,155,58,0.05)_0%,rgba(0,155,58,0.02)_100%)] p-5">
            <p className="text-sm font-semibold text-[#050505]">Ao abrir Plano você poderá:</p>
            <div className="mt-4 grid gap-3">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 text-sm leading-6 text-[#4B5563]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#009b3a]" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-black/[0.05] px-6 py-5 sm:px-7 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={handleUpgradeClick}
            className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
          >
            Abrir página Plano
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
