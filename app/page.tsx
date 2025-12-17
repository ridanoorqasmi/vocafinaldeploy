import HeroSection from '@/components/sections/HeroSection'
import FeaturesSection from '@/components/sections/FeaturesSection'
import IndustriesSection from '@/components/sections/IndustriesSection'
import CTASection from '@/components/sections/CTASection'
import TestimonialsSection from '@/components/sections/TestimonialsSection'

export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <IndustriesSection />
      <TestimonialsSection />
      <CTASection />
    </div>
  )
}
