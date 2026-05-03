"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Download, ExternalLink, Share, X } from "lucide-react"

import { Button } from "@/components/ui/button"

const DISMISS_STORAGE_KEY = "eme-pwa-install-dismissed-at"
const DISMISS_SESSION_KEY = "eme-pwa-install-dismissed-session"
const DISMISS_DAYS = 7
let dismissedInMemory = false

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type DeviceType = "desktop" | "android" | "ios"

function getDeviceType() {
  if (typeof window === "undefined") return "desktop" as DeviceType

  const userAgent = window.navigator.userAgent
  const platform = window.navigator.platform
  const maxTouchPoints = window.navigator.maxTouchPoints || 0
  const isAndroid = /Android/i.test(userAgent)
  const isIOS =
    /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)

  if (isIOS) return "ios"
  if (isAndroid) return "android"
  return "desktop"
}

function isStandalone() {
  if (typeof window === "undefined") return false

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function wasRecentlyDismissed() {
  if (dismissedInMemory) return true

  try {
    if (window.sessionStorage.getItem(DISMISS_SESSION_KEY) === "true") return true

    const dismissedAt = window.localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!dismissedAt) return false

    const timestamp = Number(dismissedAt)
    if (!Number.isFinite(timestamp)) return false

    return Date.now() - timestamp < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isManualHelpVisible, setIsManualHelpVisible] = useState(false)
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop")

  useEffect(() => {
    if ("serviceWorker" in window.navigator) {
      window.navigator.serviceWorker.register("/sw.js").catch(() => null)
    }

    if (isStandalone() || wasRecentlyDismissed()) return

    const detectedDeviceType = getDeviceType()
    setDeviceType(detectedDeviceType)

    if (detectedDeviceType === "ios") {
      const timer = window.setTimeout(() => setIsVisible(true), 1200)
      return () => window.clearTimeout(timer)
    }

    const fallbackTimer = window.setTimeout(() => setIsVisible(true), 1800)

    function handleBeforeInstallPrompt(event: Event) {
      if (isStandalone() || wasRecentlyDismissed()) return

      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    function handleAppInstalled() {
      dismiss()
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.clearTimeout(fallbackTimer)
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const copy = useMemo(() => {
    if (deviceType === "ios") {
      return {
        icon: Share,
        title: "Instalar EME",
        body: "Toque em compartilhar e depois em 'Adicionar à Tela de Início'.",
        action: "Entendi",
      }
    }

    if (deviceType === "android") {
      return {
        icon: Download,
        title: "Instalar EME",
        body: installPrompt
          ? "Adicione à tela inicial para acesso rápido"
          : "Toque no menu do navegador e depois em 'Adicionar à tela inicial'.",
        action: installPrompt ? "Instalar app" : "Entendi",
      }
    }

    return {
      icon: Download,
      title: "Instalar EME",
      body: "Adicione à tela inicial para acesso rápido",
      action: installPrompt ? "Instalar app" : "Como instalar",
    }
  }, [deviceType, installPrompt])

  function dismiss() {
    dismissedInMemory = true

    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()))
    } catch {
      // Ignore storage restrictions and only close the current prompt.
    }

    try {
      window.sessionStorage.setItem(DISMISS_SESSION_KEY, "true")
    } catch {
      // Ignore storage restrictions and only close the current prompt.
    }

    setIsVisible(false)
  }

  async function handleAction() {
    if (deviceType === "ios") {
      dismiss()
      return
    }

    if (!installPrompt) {
      if (deviceType === "android") {
        dismiss()
        return
      }

      setIsManualHelpVisible(true)
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice.catch(() => null)
    setInstallPrompt(null)

    if (choice?.outcome === "accepted") {
      dismiss()
    }
  }

  if (!isVisible) return null

  const Icon = copy.icon

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-sm">
      <div className="rounded-[1.25rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(10,10,10,0.98))] p-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-96x96.png" alt="EME" className="size-8 object-contain" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{copy.title}</p>
                <p className="mt-1 text-sm leading-5 text-white/58">{copy.body}</p>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Fechar aviso de instalação"
              >
                <X className="size-4" />
              </button>
            </div>

            {isManualHelpVisible && (
              <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs leading-5 text-white/58">
                Use o menu do navegador e escolha instalar app ou adicionar à tela inicial.
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                onClick={handleAction}
                className="h-9 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#69F0AE]"
              >
                {installPrompt || deviceType !== "desktop" ? (
                  <Icon className="size-4" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
                {copy.action}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={dismiss}
                className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/65 hover:bg-white/[0.08] hover:text-white"
              >
                <Check className="size-4" />
                Agora não
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
