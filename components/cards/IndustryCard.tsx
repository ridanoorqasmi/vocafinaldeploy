'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface Industry {
  id: string
  title: string
  description: string
  icon: LucideIcon
  features: string[]
  color: string
  useCases: string[]
}

interface IndustryCardProps {
  industry: Industry
}

const IndustryCard = ({ industry }: IndustryCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="group"
    >
      <div className="card-hover rounded-2xl h-full">
        {/* Header */}
        <div className="p-8">
          {/* Icon */}
          <div className={`w-16 h-16 bg-gradient-to-r ${industry.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
            <industry.icon className="w-8 h-8 text-white" />
          </div>

          {/* Title & Description */}
          <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-red-400 transition-colors duration-300">
            {industry.title}
          </h3>
          <p className="text-gray-300 mb-6 leading-relaxed">
            {industry.description}
          </p>

          {/* Features */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
              Key Features
            </h4>
            <ul className="space-y-2">
              {industry.features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm text-gray-300">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="px-8 pb-8">
          <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            Use Cases
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {industry.useCases.map((useCase, index) => (
              <div
                key={index}
                className="p-3 bg-gray-800/50 rounded-lg text-sm text-gray-300 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-200"
              >
                {useCase}
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="px-8 pb-8">
          <button className="w-full btn-primary text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 group-hover:from-red-600 group-hover:to-red-700">
            Learn More
          </button>
        </div>

        {/* Hover Effect Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-red-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </motion.div>
  )
}

export default IndustryCard
