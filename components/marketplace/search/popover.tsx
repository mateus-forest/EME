'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export function Popover({ label, active = false, align = 'start', children, className }: { label: React.ReactNode; active?: boolean; align?: 'start' | 'end'; children: (close: () => void) => React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 256 })
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      const width = Math.min(288, window.innerWidth - 24)
      const preferred = align === 'end' ? rect.right - width : rect.left
      setPosition({ top: Math.min(rect.bottom + 8, window.innerHeight - 220), left: Math.max(12, Math.min(preferred, window.innerWidth - width - 12)), width })
    }
    update()
    window.addEventListener('resize', update)
    const closeOnPageScroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', closeOnPageScroll, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', closeOnPageScroll, true) }
  }, [align, open])

  useEffect(() => {
    if (!open) return
    const click = (event: MouseEvent) => { const target = event.target as Node; if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])

  return <div className="relative">
    <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors', active || open ? 'border-primary/40 bg-eme-50 text-eme-700' : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-eme-50/50')}>{label}</button>
    {open && typeof document !== 'undefined' ? createPortal(<div ref={panelRef} role="dialog" style={{ position: 'fixed', top: position.top, left: position.left, width: position.width }} className={cn('marketplace-shell marketplace-popover z-[150] max-h-[min(70dvh,28rem)] overflow-y-auto rounded-2xl border border-border/70 bg-popover p-4 text-foreground shadow-[var(--shadow-float)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150', className)}>{children(() => setOpen(false))}</div>, document.body) : null}
  </div>
}
