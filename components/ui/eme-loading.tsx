import { cn } from "@/lib/utils"

import { Spinner } from "@/components/ui/spinner"

type EmeLoadingProps = {
  className?: string
  compact?: boolean
  description?: string
  message: string
  spinnerClassName?: string
}

export function EmeLoading({
  className,
  compact = false,
  description,
  message,
  spinnerClassName,
}: EmeLoadingProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]",
          className,
        )}
      >
        <Spinner className={cn("size-9 shrink-0", spinnerClassName)} />
        <div className="min-w-0">
          <p className="font-medium text-[#050505]">{message}</p>
          {description ? <p className="mt-1 text-sm text-[#6B7280]">{description}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] px-6 py-8 text-center",
        className,
      )}
    >
      <Spinner className={cn("size-16", spinnerClassName)} />
      <p className="mt-4 text-base font-medium text-[#050505]">{message}</p>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7280]">{description}</p> : null}
    </div>
  )
}
