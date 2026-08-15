"use client"

import { ChevronRight, FileText, Files, ImageIcon, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CosComposerAttachment } from "@/components/cos-prompt-composer"
import type { CosConversationItem, CosInteractionType, CosResponseOption, PendingConfirmation } from "@/components/use-cos-conversations"
import { getCosInteractionLabel } from "@/lib/cos/localization"

function getInteractionLabel(type: CosInteractionType | undefined) {
  return getCosInteractionLabel(type)
}

function parseStructuredList(content: string) {
  const lines = content.split("\n")
  const bulletIndexes = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => /^[-*]\s+/.test(line))

  if (bulletIndexes.length < 2) {
    return null
  }

  const firstBulletIndex = bulletIndexes[0]?.index ?? 0
  return {
    intro: lines.slice(0, firstBulletIndex).join("\n").trim(),
    items: bulletIndexes.map(({ line }) => line.replace(/^[-*]\s+/, "").trim()),
  }
}

type CosOptionButtonsProps = {
  options: CosResponseOption[]
  disabled?: boolean
  onSelect: (option: CosResponseOption) => void
}

export function CosOptionButtons({ options, disabled, onSelect }: CosOptionButtonsProps) {
  return (
    <div className="mt-3 grid gap-2">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant="ghost"
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="h-auto justify-between rounded-[1rem] border border-black/[0.08] bg-white px-3.5 py-3 text-left text-xs text-[#111111] hover:bg-white disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-medium text-[#111111]">{option.label}</span>
            {option.description ? (
              <span className="mt-1 block whitespace-normal text-[11px] leading-5 text-[#7B8491]">{option.description}</span>
            ) : null}
          </span>
          <ChevronRight className="ml-3 size-4 shrink-0 text-[#9aa4b2]" />
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
          <span className="min-w-0 truncate">{attachment.name}</span>
        </div>
      ))}
    </div>
  )
}

export function CosConversationMessageBody({ item }: { item: CosConversationItem }) {
  const interactionLabel = item.role === "assistant" ? getInteractionLabel(item.interactionType) : null
  const structuredList = parseStructuredList(item.content)

  return (
    <div className="space-y-3">
      {interactionLabel ? (
        <span className="inline-flex rounded-full border border-black/[0.06] bg-black/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#7b8491]">
          {interactionLabel}
        </span>
      ) : null}

      {structuredList ? (
        <div className="space-y-3">
          {structuredList.intro ? <p className="whitespace-pre-wrap break-words">{structuredList.intro}</p> : null}
          <div className="grid gap-2">
            {structuredList.items.map((entry) => (
              <div key={entry} className="rounded-[1rem] border border-black/[0.06] bg-white/70 px-3.5 py-3">
                <p className="text-[13px] leading-6 text-[#334155]">{entry}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words">{item.content}</p>
      )}
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

export function CosPendingAction({ item, pendingConfirmation, isSending, onConfirm, onCancel, onSelectOption }: CosPendingActionProps) {
  if (item.options && item.options.length > 0) {
    return <CosOptionButtons options={item.options} disabled={isSending} onSelect={onSelectOption} />
  }

  if (!item.confirmRequired || pendingConfirmation?.sourceInteractionId !== item.sourceInteractionId) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={onConfirm}
        disabled={isSending}
        className="h-9 rounded-full bg-[#111111] px-4 text-xs font-semibold text-white hover:bg-[#050505] disabled:opacity-60"
      >
        {pendingConfirmation?.confirmLabel ?? "Confirmar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={isSending}
        className="h-9 rounded-full border border-black/[0.08] px-4 text-xs text-[#4B5563] hover:bg-white"
      >
        {pendingConfirmation?.cancelLabel ?? "Cancelar"}
      </Button>
    </div>
  )
}
