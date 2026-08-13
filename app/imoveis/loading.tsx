import { EmeLoader } from '@/components/marketplace/eme-loader'

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background" aria-label="Carregando página">
      <div className="flex flex-col items-center gap-3 text-center">
        <EmeLoader />
        <p className="text-sm text-muted-foreground">Preparando sua experiência EME...</p>
      </div>
    </main>
  )
}
