import Image from "next/image"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("relative inline-flex size-4 items-center justify-center rounded-full", className)}
      {...props}
    >
      <span className="absolute inset-0 rounded-full bg-[#009b3a]/12 animate-pulse" />
      <Image
        src="/images/eme-logo-official.png"
        alt="EME"
        width={40}
        height={40}
        className="relative h-[78%] w-[78%] object-contain animate-[pulse_2.2s_ease-in-out_infinite]"
      />
    </span>
  )
}

export { Spinner }
