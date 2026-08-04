"use client"

import { FileText, Files, ImageIcon, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CosComposerAttachment } from "@/components/cos-prompt-composer"
import type { CosConversationItem, CosResponseOption, PendingConfirmation } from "@/components/use-cos-conversations"

type CosOptionButtonsProps = {
  options: CosResponseOption[]
  disabled?: boolean
  onSelect: (option: CosResponseOption) => void
}

export function CosOptionButtons({ options, disabled, onSelect }: CosOptionButtonsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="ghost"
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="h-9 rounded-full border border-black/[0.08] px-4 text-xs text-[#111111] hover:bg-white disabled:opacity-60"
        >
          {option.label}
          {option.description ? <span className="ml-1.5 text-[#7B8491]">— {option.description}</span> : null}
        </Button>
      ))}
    </div>
  )
}

type CosMessageAttachmentsProps = {
  attachments?: CosComposerAttachment[]
  inverted?: boolean
}

function AttachmentIcon({ category }: { category: CosComposerAttachment["category"] }) {
  if (category === "image") return <ImageIcon className="size-3.5 shrink-0" />
  if (category === "document") return <FileText className="size-3.5 shrink-0" />
  if (category === "video") return <Video className="size-3.5 shrink-0" />
  return <Files className="size-3.5 shrink-0" />
}

export function CosMessageAttachments({ attachments, inverted = false }: CosMessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
            inverted
              ? "border-white/18 bg-white/10 text-white/90"
              : "border-black/[0.06] bg-white text-[#5f6b7a]"
          }`}
        >
          <AttachmentIcon category={attachment.category} />
          <span className="truncate">{attachment.name}</span>
        </div>
      ))}
    </div>
  )
}

type CosPendingActionProps = {
  item: CosConversationItem
  pendingConfirmation: PendingConfirmation | null
  isSending: boolean
  onConfirm: () => void
  onCancel: () => void
  onSelectOption: (option: CosResponseOption) => void
}

// Bloco de acao pendente de uma mensagem do COS: renderiza botoes de opcao quando
// a ambiguidade traz candidatos (metadata.parsedData.options), ou o par binario
// Confirmar/Cancelar quando nao ha opcoes. Compartilhado entre broker-portal.tsx
// e broker-cos-history-page.tsx para as duas telas nao divergirem entre si.
export function CosPendingAction({ item, pendingConfirmation, isSending, onConfirm, onCancel, onSelectOption }: CosPendingActionProps) {
  if (!item.confirmRequired || pendingConfirmation?.sourceInteractionId !== item.sourceInteractionId) {
    return null
  }

  if (item.options && item.options.length > 0) {
    return <CosOptionButtons options={item.options} disabled={isSending} onSelect={onSelectOption} />
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={onConfirm}
        disabled={isSending}
        className="h-9 rounded-full bg-[#111111] px-4 text-xs font-semibold text-white hover:bg-[#050505] disabled:opacity-60"
      >
        Confirmar
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={isSending}
        className="h-9 rounded-full border border-black/[0.08] px-4 text-xs text-[#4B5563] hover:bg-white"
      >
        Cancelar
      </Button>
    </div>
  )
}
