import { cn } from "@/lib/utils"

type EmeLoaderMarkProps = React.ComponentProps<"span"> & {
  imageClassName?: string
}

export function EmeLoaderMark({ className, imageClassName, ...props }: EmeLoaderMarkProps) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn("eme-loader-mark relative grid size-[78px] place-items-center", className)}
      {...props}
    >
      <span aria-hidden className="eme-loader-mark-halo absolute" />
      {/* O SVG é extraído sem alterações da implementação de loading aprovada. */}
      <img
        src="/eme-loader-mark.svg"
        alt="EME"
        width={66}
        height={66}
        loading="eager"
        fetchPriority="high"
        className={cn("eme-loader-mark-logo relative block object-contain", imageClassName)}
      />
      <span aria-hidden className="eme-loader-mark-glint absolute pointer-events-none overflow-hidden" />
    </span>
  )
}
