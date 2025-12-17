'use client'

import { motion } from 'framer-motion'
import { Brain, Globe, Shield, Zap, Users, Clock, BarChart3, Mic } from 'lucide-react'

const features = [
  {
    icon: Mic,
    title: 'Advanced Voice Recognition',
    description: 'State-of-the-art speech recognition with 99.9% accuracy across multiple languages and accents.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: Brain,
    title: 'AI-Powered Intelligence',
    description: 'Natural language processing that understands context, intent, and provides intelligent responses.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: Globe,
    title: 'Multi-Language Support',
    description: 'Support for 50+ languages with real-time translation and localization capabilities.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-level encryption and compliance with GDPR, HIPAA, and SOC 2 Type II standards.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: Zap,
    title: 'Real-time Processing',
    description: 'Lightning-fast response times with real-time voice processing and instant feedback.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: Users,
    title: 'Scalable Solutions',
    description: 'From startups to Fortune 500 companies, our solutions scale with your business needs.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: Clock,
    title: '24/7 Availability',
    description: 'Always-on voice assistants that never sleep, providing round-the-clock support.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Insights',
    description: 'Comprehensive analytics and insights to optimize your voice AI performance.',
    color: 'from-red-500 to-red-600',
  },
]

const FeaturesSection = () => {
  return (
    <section className="py-24 bg-neutral-900 border-t border-red-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Powerful Features for
            <span className="block gradient-text">Enhanced Communication</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover the comprehensive suite of features that make <span className="text-red-400 font-semibold">Voca</span> the leading 
            choice for AI voice assistant solutions.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="group relative">
              <div className="card-hover rounded-2xl p-8 h-full">
                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-4 group-hover:text-red-400 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-red-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 rounded-2xl p-8 border border-red-500/20">
            <h3 className="text-2xl font-bold text-white mb-4">
              Ready to Experience the Future?
            </h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Join thousands of businesses already using <span className="text-red-400 font-semibold">Voca</span> to transform their 
              customer experience and streamline operations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/chat-agent"
                className="btn-primary text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200"
              >
                Start Free Trial
              </a>
              <a
                href="#contact"
                className="btn-secondary px-8 py-3 rounded-lg font-semibold transition-all duration-200"
              >
                Schedule Demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
