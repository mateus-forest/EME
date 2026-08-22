import { Header } from '@/components/marketplace/header'
import { Footer } from '@/components/marketplace/footer'

// Estrutura base das páginas públicas: header fixo, main com respiro para o header e footer.
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketplace-page flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 pt-16 md:pt-20">{children}</main>
      <Footer />
    </div>
  )
}
