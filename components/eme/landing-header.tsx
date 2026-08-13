export function LandingHeader({
  onEntrar,
  onComecar,
  authOpen = false,
}: {
  onEntrar?: () => void
  onComecar?: () => void
  authOpen?: boolean
}) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-[75]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-end gap-4 px-5 py-3.5 sm:px-12 sm:py-9">
        <div
          className="flex flex-shrink-0 items-center gap-2.5 transition-opacity duration-500 ease-out"
          style={{
            opacity: authOpen ? 0 : 1,
            pointerEvents: authOpen ? "none" : undefined,
          }}
          aria-hidden={authOpen}
        >
          <button
            type="button"
            onClick={onEntrar}
            tabIndex={authOpen ? -1 : undefined}
            className="rounded-full border border-eme/25 bg-white/60 px-4 py-1.5 text-[13px] font-medium tracking-tight text-eme-dark backdrop-blur-sm transition-colors hover:bg-eme/10 sm:px-5 sm:py-2 sm:text-[13.5px]"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onComecar}
            tabIndex={authOpen ? -1 : undefined}
            className="eme-gradient hidden whitespace-nowrap rounded-full px-5 py-2 text-[13.5px] font-medium tracking-tight text-primary-foreground shadow-[0_10px_24px_-12px_rgba(28,120,60,0.6)] transition-[transform,filter] hover:-translate-y-0.5 sm:inline-block"
          >
            Começar agora
          </button>
        </div>
      </div>
    </header>
  )
}
