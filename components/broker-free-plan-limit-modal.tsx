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
      <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-xl">
        <DialogHeader className="border-b border-white/[0.08] px-6 py-5">
          <DialogTitle className="text-xl text-white">
            Você atingiu o limite do ambiente de avaliação
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-white/55">
            O modo teste permite até 3 imóveis publicados durante a avaliação. Configure seu plano
            para continuar publicando e manter seu catálogo ativo sem limitações.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="rounded-[1.5rem] border border-[#00C853]/20 bg-[#00C853]/10 p-4 text-sm leading-6 text-[#69F0AE]">
            O upgrade leva você para a área de plano, onde pacotes, Corretor M e créditos IA ficam organizados.
          </div>
        </div>

        <DialogFooter className="border-t border-white/[0.08] px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white"
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={handleUpgradeClick}
            className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
          >
            Fazer upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
