"use client"

import { useRouter } from "next/navigation"

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

export function BrokerFreePlanLimitModal({
  open,
  onOpenChange,
}: BrokerFreePlanLimitModalProps) {
  const router = useRouter()

  function handleUpgradeClick() {
    onOpenChange(false)
    router.push("/corretor/plano")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-black/[0.06] bg-white/90 p-0 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-xl">
        <DialogHeader className="border-b border-black/[0.06] px-6 py-5">
          <DialogTitle className="text-xl text-[#050505]">
            Você atingiu o limite do ambiente de avaliação
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[#6B7280]">
            O modo teste permite até 3 imóveis publicados durante a avaliação. Configure seu plano
            para continuar publicando e manter seu catálogo ativo sem limitações.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="rounded-[1.5rem] border border-[#009b3a]/20 bg-[#009b3a]/10 p-4 text-sm leading-6 text-[#009b3a]">
            O upgrade leva você para a área de plano, onde assinatura, Assessor EME e créditos IA ficam organizados.
          </div>
        </div>

        <DialogFooter className="border-t border-black/[0.06] px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={handleUpgradeClick}
            className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
          >
            Assinar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
