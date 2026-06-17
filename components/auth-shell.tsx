"use client"

import Link from "next/link"
import Image from "next/image"
import { ReactNode } from "react"

type AuthShellProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#F8FAF9_0%,#F4F6F5_40%,#EEF2F0_100%)] px-4 py-10">
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#00C853]/6 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(17,24,39,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,0.035)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden lg:block">
            <Link href="/" className="mb-10 inline-flex">
              <Image
                src="/images/eme-logo.png"
                alt="EME"
                width={160}
                height={64}
                className="h-14 w-auto"
                priority
              />
            </Link>

            <div className="max-w-xl">
              <span className="mb-5 inline-flex rounded-full border border-[#00C853]/30 bg-[#00C853]/10 px-4 py-2 text-sm font-medium text-[#00C853]">
                Fluxo de acesso EME
              </span>
              <h1 className="mb-5 text-5xl font-bold leading-tight text-[#111111]">
                Publique mais rápido com uma experiência simples desde o primeiro clique.
              </h1>
              <p className="text-lg leading-relaxed text-[#6B7280]">
                Entre ou crie sua conta para começar com a mesma experiência premium da landing,
                agora em um fluxo claro e direto.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_28px_80px_rgba(17,24,39,0.12)] backdrop-blur-xl sm:p-8">
              <div className="mb-8 lg:hidden">
                <Link href="/" className="mb-6 inline-flex">
                  <Image
                    src="/images/eme-logo.png"
                    alt="EME"
                    width={148}
                    height={60}
                    className="h-12 w-auto"
                    priority
                  />
                </Link>
              </div>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-[#111111]">{title}</h2>
                <p className="mt-2 text-base leading-relaxed text-[#6B7280]">{subtitle}</p>
              </div>

              {children}

              {footer ? <div className="mt-8 border-t border-[#E5E7EB] pt-6">{footer}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
