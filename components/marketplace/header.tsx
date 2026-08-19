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
import { AssistantLauncher } from '@/components/marketplace/assistant/assistant-launcher'
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
  const [pastHero, setPastHero] = useState(false)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const updateHeaderPosition = () => {
      setScrolled(window.scrollY > 12)

      if (pathname !== '/imoveis') {
        setPastHero(false)
        return
      }

      const hero = document.querySelector<HTMLElement>('[data-marketplace-hero]')
      const headerHeight = window.matchMedia('(min-width: 768px)').matches ? 80 : 64
      setPastHero(!hero || hero.getBoundingClientRect().bottom <= headerHeight)
    }

    updateHeaderPosition()
    window.addEventListener('scroll', updateHeaderPosition, { passive: true })
    window.addEventListener('resize', updateHeaderPosition)
    return () => {
      window.removeEventListener('scroll', updateHeaderPosition)
      window.removeEventListener('resize', updateHeaderPosition)
    }
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
  const overHero = pathname === '/imoveis' && !pastHero && !open

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        overHero
          ? 'border-0 bg-transparent'
          : scrolled || open
            ? 'border-b border-border/60 bg-background/88 shadow-[0_8px_30px_rgba(16,24,20,0.035)] backdrop-blur-xl'
            : 'border-b border-transparent bg-background/55 backdrop-blur-md',
      )}
    >
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:h-20 md:px-8">
        <Link
          href="/imoveis"
          aria-label="EME Imóveis — página inicial"
          className="rounded-xl outline-none transition-transform duration-300 hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/15"
        >
          <Logo markOnly size="lg" className="md:[&_img]:h-12 md:[&_img]:w-12" />
        </Link>

        <nav
          className={cn(
            'hidden items-center gap-1 rounded-full p-1 transition-colors md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2',
            overHero ? 'bg-transparent' : 'glass-strong shadow-[var(--shadow-soft)]',
          )}
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
                    ? overHero
                      ? 'bg-white/15 text-white shadow-sm backdrop-blur-md'
                      : 'bg-background text-foreground shadow-sm'
                    : overHero
                      ? 'text-white/85 hover:bg-white/10 hover:text-white'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 transition-colors duration-300',
                    overHero
                      ? 'text-white/85 group-hover:text-white'
                      : active
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-primary',
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

        <div className="ml-auto hidden items-center gap-1.5 md:flex lg:gap-2">
          <AssistantLauncher
            className={cn(
              overHero &&
                '!border-white/15 !bg-white/[0.08] !text-white !shadow-none backdrop-blur-md hover:!border-white/25 hover:!bg-white/[0.13]',
            )}
          />

          <a
            href={EME_OFFICIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'group hidden items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 lg:flex',
              overHero ? 'text-white/85 hover:text-white' : 'text-foreground/75 hover:text-primary',
            )}
          >
            Sou corretor
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>

        <button
          type="button"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border shadow-sm outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/15 md:hidden',
            overHero
              ? 'border-white/20 bg-white/[0.08] text-white backdrop-blur-md hover:bg-white/15'
              : 'border-border/70 bg-background/80 text-foreground hover:bg-secondary',
          )}
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
            <AssistantLauncher variant="menu" onBeforeOpen={() => setOpen(false)} />
            <a
              href={EME_OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 text-base font-medium text-primary outline-none transition-colors hover:bg-eme-50 focus-visible:ring-4 focus-visible:ring-primary/15"
            >
              Sou corretor
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
