"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Headset, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createBrokerSupportWhatsAppUrl,
  SUPPORT_CATEGORIES,
  type SupportCategory,
} from "@/lib/support"

type BrokerSupportQuickAccessProps = {
  tone?: "light" | "dark"
  brokerName: string
  planName: string | null | undefined
}

export function BrokerSupportQuickAccess({
  tone = "light",
  brokerName,
  planName,
}: BrokerSupportQuickAccessProps) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<SupportCategory | "">("")
  const pathname = usePathname()
  const isLight = tone === "light"

  const trimmedDescription = description.trim()
  const whatsappUrl = useMemo(
    () =>
      trimmedDescription
        ? createBrokerSupportWhatsAppUrl({
            category,
            description: trimmedDescription,
            brokerName,
            planName,
            pagePath: pathname || "/",
          })
        : "",
    [brokerName, category, pathname, planName, trimmedDescription],
  )

  function resetForm() {
    setDescription("")
    setCategory("")
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  function handleContinue() {
    if (!whatsappUrl) return

    window.open(whatsappUrl, "_blank", "noopener,noreferrer")
    setOpen(false)
    resetForm()
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Fale com o suporte"
        className={
          isLight
            ? "relative h-8.5 w-8.5 rounded-xl border border-black/[0.06] bg-white/80 px-0 text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
            : "relative h-8.5 w-8.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-0 text-white/75 hover:bg-white/[0.08] hover:text-white"
        }
      >
        <Headset className="size-4.5" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-black/[0.06] bg-white/95 p-0 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-lg">
          <DialogHeader className="border-b border-black/[0.05] px-6 py-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-[#009b3a]/18 bg-[#009b3a]/10 text-[#009b3a]">
              <Headset className="size-5" />
            </div>
            <DialogTitle className="mt-4 text-[1.75rem] leading-tight text-[#050505]">
              Fale com o suporte
            </DialogTitle>
            <DialogDescription className="mt-3 text-sm leading-7 text-[#5F6B7A] sm:text-[15px]">
              Conte rapidamente o que está acontecendo. Ao continuar, sua mensagem será enviada para nossa equipe pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#050505]">Categoria</p>
              <Select value={category} onValueChange={(value) => setCategory(value as SupportCategory)}>
                <SelectTrigger className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[#050505]">Como podemos ajudar?</p>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descreva seu problema ou dúvida..."
                className="min-h-32 rounded-[1.25rem] border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-black/[0.05] px-6 py-5 sm:justify-between">
            <p className="text-xs leading-6 text-[#7B8491]">
              Vamos incluir automaticamente seu plano, a página atual e o horário desta solicitação.
            </p>
            <Button
              type="button"
              onClick={handleContinue}
              disabled={!trimmedDescription}
              className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:bg-[#cfe9d8] disabled:text-white disabled:shadow-none"
            >
              <MessageCircle className="size-4" />
              Continuar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
