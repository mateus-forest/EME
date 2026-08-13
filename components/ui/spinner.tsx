import { EmeLoaderMark } from "@/components/ui/eme-loader-mark"
import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <EmeLoaderMark
      className={cn("inline-grid size-4 shrink-0", className)}
      {...props}
    />
  )
}

export { Spinner }
