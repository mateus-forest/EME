'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Popover leve e acessível para os filtros rápidos.
 * Fecha ao clicar fora e ao pressionar Escape; devolve o foco ao gatilho.
 */
export function Popover({
  label,
  active = false,
  align = 'start',
  children,
  className,
}: {
  label: React.ReactNode
  active?: boolean
  align?: 'start' | 'end'
  children: (close: () => void) => React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative z-[70]">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors',
          active || open
            ? 'border-primary/40 bg-eme-50 text-eme-700'
            : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-eme-50/50',
        )}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          className={cn(
            'absolute top-[calc(100%+0.5rem)] z-[80] w-64 origin-top rounded-2xl border border-border/70 bg-popover p-4 shadow-[var(--shadow-float)]',
            'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
