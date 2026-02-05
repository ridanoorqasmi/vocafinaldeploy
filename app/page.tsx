import HeroSection from '@/components/sections/HeroSection'
import WhatVocaDoesSection from '@/components/sections/WhatVocaDoesSection'
import IndustriesSectionMinimal from '@/components/sections/IndustriesSectionMinimal'
import EarlyAccessFormSection from '@/components/sections/EarlyAccessFormSection'

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <HeroSection />
      <WhatVocaDoesSection />
      <IndustriesSectionMinimal />
      <EarlyAccessFormSection />
    </div>
  )
}
