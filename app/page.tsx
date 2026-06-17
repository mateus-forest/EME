import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { ProductFlow } from "@/components/product-flow"
import { ProposalDocumentsSection } from "@/components/proposal-documents-section"
import { AssessorEmeSection } from "@/components/assessor-eme-section"
import { EmeModulesSection } from "@/components/eme-modules-section"
import { CatalogIntelligentSection } from "@/components/catalog-intelligent-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { FlowLine } from "@/components/flow-line"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#F8FAF9_0%,#F4F6F5_40%,#EEF2F0_100%)]">
      <FlowLine />
      <Header />
      <Hero />
      <AssessorEmeSection />
      <ProductFlow />
      <ProposalDocumentsSection />
      <CatalogIntelligentSection />
      <EmeModulesSection />
      <CTASection />
      <Footer />
    </main>
  )
}
