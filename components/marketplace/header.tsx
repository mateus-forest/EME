'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowUpRight,
  Building2,
  KeyRound,
  MapPinned,
  Menu,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from '@/components/marketplace/logo'
import { AssistantMark } from '@/components/marketplace/assistant/assistant-mark'
import { useEmeAssistant } from '@/components/marketplace/assistant/assistant-provider'
import { EME_OFFICIAL_URL, mainNav } from '@/lib/marketplace/site'
import { cn } from '@/lib/utils'

const navIcons: Record<string, LucideIcon> = {
  '/imoveis/comprar': Building2,
  '/imoveis/alugar': KeyRound,
  '/imoveis/regioes': MapPinned,
  '/imoveis/corretores': UsersRound,
}

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { open: assistantOpen, openAssistant } = useEmeAssistant()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled || open
          ? 'border-b border-border/60 bg-background/88 shadow-[0_8px_30px_rgba(16,24,20,0.035)] backdrop-blur-xl'
          : 'border-b border-transparent bg-background/55 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:h-20 md:px-8">
        <Link
          href="/imoveis"
          aria-label="EME Imóveis — página inicial"
          className="rounded-xl outline-none transition-transform duration-300 hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/15"
        >
          <Logo markOnly size="lg" className="md:[&_img]:h-12 md:[&_img]:w-12" />
        </Link>

        <nav
          className="glass-strong hidden items-center gap-1 rounded-full p-1 shadow-[var(--shadow-soft)] md:flex"
          aria-label="Navegação principal"
        >
          {mainNav.map((item) => {
            const active = isActive(item.href)
            const Icon = navIcons[item.href]
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/30',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 transition-colors duration-300',
                    active ? 'text-primary' : 'text-muted-foreground group-hover:text-primary',
                  )}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {item.label}
                <span
                  className={cn(
                    'absolute inset-x-4 -bottom-1 h-px origin-center rounded-full bg-primary transition-transform duration-300',
                    active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-60',
                  )}
                  aria-hidden="true"
                />
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={openAssistant}
          aria-expanded={assistantOpen}
          aria-haspopup="dialog"
          className="group hidden items-center gap-2 rounded-full border border-border/70 bg-background/85 py-1.5 pl-2 pr-3.5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] outline-none transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/15 md:flex"
        >
          <AssistantMark size="sm" className="h-7 w-7 [&_img]:h-5 [&_img]:w-5" />
          <span>Assistente EME</span>
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(43,167,94,.10)]" aria-label="Online" />
        </button>

        <a
          href={EME_OFFICIAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-foreground/75 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 lg:flex"
        >
          Conhecer o EME
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground shadow-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/15 md:hidden"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className={cn('md:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div
          className={cn(
            'absolute inset-x-0 top-full z-40 h-[calc(100dvh-4rem)] overflow-y-auto bg-background transition-all duration-300',
            open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
          )}
        >
          <nav className="flex flex-col gap-2 px-5 py-6" aria-label="Navegação mobile">
            {mainNav.map((item) => {
              const active = isActive(item.href)
              const Icon = navIcons[item.href]
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-4 py-4 text-base font-medium outline-none transition-all focus-visible:ring-4 focus-visible:ring-primary/15',
                    active
                      ? 'border-eme-100 bg-eme-50 text-foreground shadow-sm'
                      : 'border-transparent text-foreground hover:border-border hover:bg-secondary',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      active ? 'bg-background text-primary shadow-sm' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  {item.label}
                  {active && <span className="ml-auto h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openAssistant()
              }}
              className="mt-2 flex items-center gap-3 rounded-2xl border border-primary/20 bg-eme-50 px-4 py-3.5 text-left text-base font-medium text-foreground outline-none transition-colors hover:bg-eme-100 focus-visible:ring-4 focus-visible:ring-primary/15"
              aria-haspopup="dialog"
            >
              <AssistantMark size="md" />
              <span className="flex-1">
                Assistente EME
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Tecnologia COS · online</span>
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(43,167,94,.10)]" aria-label="Online" />
            </button>
            <a
              href={EME_OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 text-base font-medium text-primary outline-none transition-colors hover:bg-eme-50 focus-visible:ring-4 focus-visible:ring-primary/15"
            >
              Conhecer o EME
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
