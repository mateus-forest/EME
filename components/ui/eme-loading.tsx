import { cn } from "@/lib/utils"
import { EmeLoaderMark } from "@/components/ui/eme-loader-mark"
import type { ReactNode } from "react"

type EmeLoadingProps = {
  className?: string
  compact?: boolean
  description?: string
  message: string
  logoClassName?: string
  action?: ReactNode
}

export function EmeLoading({
  className,
  compact = false,
  description,
  message,
  logoClassName,
  action,
}: EmeLoadingProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[1.5rem] border border-[#dfe8e1] bg-[linear-gradient(180deg,#fdfefd_0%,#f5f8f4_100%)] px-4 py-3 text-sm text-[#5F6B7A] shadow-[0_14px_30px_-26px_rgba(18,51,34,0.22)]",
          className,
        )}
      >
        <EmeLoaderMark className={cn("h-14 w-14 shrink-0", logoClassName)} />
        <div className="min-w-0">
          <p className="font-medium tracking-tight text-[#173222]">{message}</p>
          {description ? <p className="mt-1 text-sm text-[#6B7280]">{description}</p> : null}
          <div aria-hidden className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-[#dfe9e2]">
            <span className="eme-loading-bar block h-full w-[42%] rounded-full bg-[linear-gradient(90deg,#16924a_0%,#63d191_100%)] motion-reduce:animate-none" />
          </div>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(183,225,200,0.26)_0%,_rgba(251,252,249,0.96)_28%,_#f7faf7_62%,_#f3f7f3_100%)] px-6 py-10 text-center",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[16%] h-40 w-40 -translate-x-1/2 rounded-full bg-[rgba(49,160,92,0.1)] blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[min(28rem,calc(100vw-2rem))] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.9)_0%,_rgba(255,255,255,0)_72%)]" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <EmeLoaderMark className={cn("h-44 w-44 sm:h-52 sm:w-52", logoClassName)} />
        <p className="mt-8 text-[clamp(1.7rem,2vw,2.2rem)] font-semibold tracking-[-0.03em] text-[#143125]">
          {message}
        </p>
        {description ? <p className="mt-2 text-sm leading-6 text-[#6b7882] sm:text-[15px]">{description}</p> : null}
        <div aria-hidden className="mt-7 h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-[#dde8e0]">
          <span className="eme-loading-bar block h-full w-[38%] rounded-full bg-[linear-gradient(90deg,#17964c_0%,#76d59e_60%,#17964c_100%)] motion-reduce:animate-none" />
        </div>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  )
}
