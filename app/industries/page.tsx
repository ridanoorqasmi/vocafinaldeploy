import IndustryCard from '@/components/cards/IndustryCard'
import { ShoppingCart, Heart, GraduationCap, Building2, Car, Plane, Home, Briefcase } from 'lucide-react'

const industries = [
  {
    id: 'ecommerce',
    title: 'E-commerce',
    description: 'Enhance customer experience with AI-powered voice shopping assistants and personalized recommendations.',
    icon: ShoppingCart,
    features: ['Voice product search', 'Order tracking', 'Customer support', 'Personalized recommendations'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Voice-enabled product discovery',
      'Hands-free shopping experience',
      'Multilingual customer support',
      'Inventory management via voice'
    ]
  },
  {
    id: 'healthcare',
    title: 'Healthcare',
    description: 'Improve patient care with intelligent voice assistants for medical professionals and patients.',
    icon: Heart,
    features: ['Patient scheduling', 'Medical transcription', 'Health monitoring', 'Emergency alerts'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Voice-enabled patient records',
      'Medical appointment scheduling',
      'Health monitoring reminders',
      'Emergency response systems'
    ]
  },
  {
    id: 'education',
    title: 'Education',
    description: 'Transform learning with AI voice assistants that adapt to individual student needs.',
    icon: GraduationCap,
    features: ['Language learning', 'Study assistance', 'Accessibility tools', 'Interactive lessons'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Language pronunciation practice',
      'Voice-enabled study guides',
      'Accessibility for visually impaired',
      'Interactive classroom management'
    ]
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Secure and efficient financial services with voice-enabled banking and investment tools.',
    icon: Building2,
    features: ['Account management', 'Voice payments', 'Investment advice', 'Fraud detection'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Voice-enabled banking',
      'Investment portfolio management',
      'Financial planning assistance',
      'Secure voice authentication'
    ]
  },
  {
    id: 'automotive',
    title: 'Automotive',
    description: 'Next-generation in-car experience with intelligent voice control and navigation.',
    icon: Car,
    features: ['Voice navigation', 'Climate control', 'Entertainment', 'Safety alerts'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Hands-free vehicle control',
      'Voice navigation systems',
      'Emergency assistance',
      'Vehicle diagnostics'
    ]
  },
  {
    id: 'travel',
    title: 'Travel & Hospitality',
    description: 'Enhance guest experience with AI voice assistants for hotels and travel services.',
    icon: Plane,
    features: ['Booking assistance', 'Concierge services', 'Local recommendations', 'Language translation'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Hotel room automation',
      'Travel booking assistance',
      'Local attraction guides',
      'Multilingual guest support'
    ]
  },
  {
    id: 'real-estate',
    title: 'Real Estate',
    description: 'Streamline property management and client interactions with voice-enabled solutions.',
    icon: Home,
    features: ['Property search', 'Virtual tours', 'Client management', 'Maintenance requests'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Voice-enabled property search',
      'Virtual property tours',
      'Maintenance request handling',
      'Client communication automation'
    ]
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    description: 'Boost productivity with AI voice assistants for business operations and team collaboration.',
    icon: Briefcase,
    features: ['Meeting assistance', 'Document creation', 'Task management', 'Analytics'],
    color: 'from-red-500 to-red-600',
    useCases: [
      'Voice-enabled meetings',
      'Document dictation',
      'Project management',
      'Business intelligence queries'
    ]
  }
]

export default function IndustriesPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 text-white border-b border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              AI Voice Solutions for <span className="text-red-400">Every Industry</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
              Discover how <span className="text-red-400 font-semibold">Voca's</span> AI voice assistants can transform your business operations 
              and enhance customer experiences across all sectors.
            </p>
          </div>
        </div>
      </div>

      {/* Industries Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {industries.map((industry) => (
            <IndustryCard key={industry.id} industry={industry} />
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-black border-t border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Industry?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Let's discuss how <span className="text-red-400 font-semibold">Voca</span> can help you implement AI voice solutions 
              tailored to your specific industry needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/chat-agent"
                className="btn-primary text-white px-8 py-3 rounded-lg text-lg font-medium transition-all duration-200"
              >
                Try Demo
              </a>
              <a
                href="#contact"
                className="btn-secondary px-8 py-3 rounded-lg text-lg font-medium transition-all duration-200"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
