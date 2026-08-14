import { Header } from '@/components/marketplace/header'
import { Footer } from '@/components/marketplace/footer'
import { Hero } from '@/components/marketplace/sections/hero'
import { LifestyleSection } from '@/components/marketplace/sections/lifestyle'
import { PropertiesSection } from '@/components/marketplace/sections/properties'
import { ComparisonSection } from '@/components/marketplace/sections/comparison'
import { EnvironmentExplorer } from '@/components/marketplace/sections/environment-explorer'
import { RegionsSection } from '@/components/marketplace/sections/regions'
import { BrokersSection } from '@/components/marketplace/sections/brokers'
import { FeaturesSection } from '@/components/marketplace/sections/features'
import { ClosingCta } from '@/components/marketplace/sections/closing-cta'
import { getMarketplaceBrokers, getMarketplaceProperties, getMarketplacePropertyCards, getMarketplaceRegions } from '@/lib/marketplace/server-data'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [properties, searchResults, brokers, regions] = await Promise.all([
    getMarketplacePropertyCards(3),
    getMarketplaceProperties(),
    getMarketplaceBrokers(),
    getMarketplaceRegions(),
  ])
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Header />
      <main>
        <Hero />
        <LifestyleSection />
        <PropertiesSection properties={properties} />
        <ComparisonSection results={searchResults.slice(0, 2)} />
        <EnvironmentExplorer />
        <RegionsSection regions={regions} />
        <BrokersSection brokers={brokers} />
        <FeaturesSection />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  )
}
