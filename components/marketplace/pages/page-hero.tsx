import { OrganicLines } from '@/components/marketplace/organic-lines'
import { cn } from '@/lib/utils'

// Abertura editorial reutilizável das páginas públicas.
// O slot `action` recebe o campo de busca específico de cada página.
export function PageHero({
  eyebrow,
  title,
  text,
  action,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: string
  text: string
  action?: React.ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  const centered = align === 'center'
  return (
    <section className={cn('relative overflow-hidden', className)}>
      <OrganicLines className="opacity-55" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />
      <div
        className={cn(
          'relative mx-auto w-full max-w-6xl px-5 pb-10 pt-12 md:px-8 md:pb-16 md:pt-20',
          centered && 'text-center',
        )}
      >
        <div className={cn('max-w-2xl', centered && 'mx-auto')}>
          {eyebrow && (
            <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-primary shadow-[var(--shadow-soft)]">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              {eyebrow}
            </span>
          )}
          <h1 className="mt-5 text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {text}
          </p>
          {action && <div className={cn('mt-7 md:mt-8', centered && 'mx-auto')}>{action}</div>}
        </div>
      </div>
    </section>
  )
}
