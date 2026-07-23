import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"

import { AuthV0Experience } from "@/components/auth-v0-experience"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${geist.variable} ${geistMono.variable} min-h-screen`}>
      <AuthV0Experience />
      <div className="hidden">{children}</div>
    </div>
  )
}
