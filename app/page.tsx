import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { ProductFlow } from "@/components/product-flow"
import { DistributionSection } from "@/components/distribution-section"
import { IntelligentSearchSection } from "@/components/intelligent-search-section"
import { LeadCaptureSection } from "@/components/lead-capture-section"
import { CorretorEmeSection } from "@/components/corretor-eme-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { FlowLine } from "@/components/flow-line"

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] relative overflow-x-hidden">
      <FlowLine />
      <Header />
      <Hero />
      <ProductFlow />
      <IntelligentSearchSection />
      <CorretorEmeSection />
      <DistributionSection />
      <LeadCaptureSection />
      <CTASection />
      <Footer />
    </main>
  )
}
