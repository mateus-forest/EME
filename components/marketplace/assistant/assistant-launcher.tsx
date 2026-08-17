'use client'

import { AssistantMark } from '@/components/marketplace/assistant/assistant-mark'
import { useEmeAssistant } from '@/components/marketplace/assistant/assistant-provider'
import { cn } from '@/lib/utils'

export function AssistantLauncher({
  variant = 'compact',
  className,
  labelClassName,
  onBeforeOpen,
}: {
  variant?: 'compact' | 'menu'
  className?: string
  labelClassName?: string
  onBeforeOpen?: () => void
}) {
  const { open, openAssistant } = useEmeAssistant()

  function launch() {
    onBeforeOpen?.()
    openAssistant()
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={launch}
        aria-label="Abrir Assistente EME"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'mt-2 flex items-center gap-3 rounded-2xl border border-primary/20 bg-eme-50 px-4 py-3.5 text-left text-base font-medium text-foreground outline-none transition-colors hover:bg-eme-100 focus-visible:ring-4 focus-visible:ring-primary/15',
          className,
        )}
      >
        <AssistantMark size="md" />
        <span className="flex-1">
          Assistente EME
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Tecnologia COS · online</span>
        </span>
        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(43,167,94,.10)]" aria-label="Online" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={launch}
      aria-label="Abrir Assistente EME"
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(
        'group flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 py-1 pl-1 pr-2.5 text-[11px] font-medium text-foreground shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:ring-primary/15',
        className,
      )}
    >
      <AssistantMark size="sm" className="h-6 w-6" />
      <span className={labelClassName}>Assistente EME</span>
      <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px_rgba(43,167,94,.08)]" aria-label="Online" />
    </button>
  )
}
