'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mic, Play, ArrowRight, Sparkles, Zap, Shield } from 'lucide-react'

const HeroSection = () => {
  const [currentFeature, setCurrentFeature] = useState(0)
  
  const features = [
    { icon: Sparkles, text: 'AI-Powered Voice Recognition' },
    { icon: Zap, text: 'Real-time Natural Language Processing' },
    { icon: Shield, text: 'Enterprise-Grade Security' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [features.length])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden ai-network-bg">
      {/* Enhanced AI Network Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Network Nodes */}
        <div className="network-node"></div>
        <div className="network-node"></div>
        <div className="network-node"></div>
        <div className="network-node"></div>
        <div className="network-node"></div>
        <div className="network-node"></div>
        <div className="network-node"></div>
        <div className="network-node"></div>
        
        {/* Network Connections */}
        <div className="network-connection"></div>
        <div className="network-connection"></div>
        <div className="network-connection"></div>
        <div className="network-connection"></div>
        <div className="network-connection"></div>
        <div className="network-connection"></div>
        
        {/* Additional Glowing Elements */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-red-400 rounded-full animate-pulse opacity-40"></div>
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-red-500 rounded-full animate-pulse opacity-70"></div>
        <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-red-400 rounded-full animate-pulse opacity-50"></div>
        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-300 rounded-full animate-pulse opacity-80"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          {/* Animated Feature Badge */}
          <motion.div
            key={currentFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 bg-black/50 backdrop-blur-sm border border-red-500/30 rounded-full px-6 py-3 mb-8 shadow-lg"
          >
            {(() => {
              const IconComponent = features[currentFeature].icon;
              return <IconComponent className="w-5 h-5 text-red-400" />;
            })()}
            <span className="text-gray-200 font-medium">{features[currentFeature].text}</span>
          </motion.div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Transform Your Business with
            <span className="block gradient-text">AI Voice Solutions</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
            Experience the future of AI communication with <span className="text-red-400 font-semibold">Voca</span>. Professional, responsive, 
            and engaging voice AI solutions that understand, respond, and adapt to your needs.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
            <Link
              href="/chat-agent"
              className="group btn-primary text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center space-x-2"
            >
              <Mic className="w-5 h-5" />
              <span>Try Voice Demo</span>
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </Link>
            
            <button className="group btn-secondary px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center space-x-2">
              <Play className="w-5 h-5" />
              <span>Watch Demo</span>
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-red-400 mb-2">99.9%</div>
              <div className="text-gray-300">Accuracy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-red-400 mb-2">50+</div>
              <div className="text-gray-300">Languages Supported</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-red-400 mb-2">24/7</div>
              <div className="text-gray-300">Always Available</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Down Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="w-6 h-10 border-2 border-red-500/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-red-400 rounded-full mt-2 animate-bounce" />
        </div>
      </div>
    </section>
  )
}

export default HeroSection
