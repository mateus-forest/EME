import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { ProductFlow } from "@/components/product-flow"
import { ProposalDocumentsSection } from "@/components/proposal-documents-section"
import { AssessorEmeSection } from "@/components/assessor-eme-section"
import { EmeModulesSection } from "@/components/eme-modules-section"
import { CatalogIntelligentSection } from "@/components/catalog-intelligent-section"
import { IntelligentSearchSection } from "@/components/intelligent-search-section"
import { LeadCaptureSection } from "@/components/lead-capture-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { FlowLine } from "@/components/flow-line"

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] relative overflow-x-hidden">
      <FlowLine />
      <Header />
      <Hero />
      <AssessorEmeSection />
      <ProductFlow />
      <ProposalDocumentsSection />
      <CatalogIntelligentSection />
      <IntelligentSearchSection />
      <EmeModulesSection />
      <LeadCaptureSection />
      <CTASection />
      <Footer />
    </main>
  )
}
