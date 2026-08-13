import { cn } from '@/lib/utils'

export function SectionHeading({
  title,
  support,
  className,
}: {
  title: string
  support?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {support && (
        <p className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
          {support}
        </p>
      )}
    </div>
  )
}
