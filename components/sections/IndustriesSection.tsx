'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ShoppingCart, Heart, GraduationCap, Building2, Car, Plane, Home, Briefcase, ArrowRight } from 'lucide-react'

const industries = [
  {
    icon: ShoppingCart,
    title: 'E-commerce',
    description: 'Automate customer support and order management with AI-powered chat bots.',
    color: 'from-red-500 to-red-600',
    features: ['Automated order tracking', 'Customer support bots', 'Product recommendations'],
  },
  {
    icon: Heart,
    title: 'Healthcare',
    description: 'Streamline patient services with intelligent automation bots for scheduling and support.',
    color: 'from-red-500 to-red-600',
    features: ['Appointment scheduling', 'Patient inquiries', 'Health information bots'],
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'Enhance learning experiences with AI bots that provide instant support and information.',
    color: 'from-red-500 to-red-600',
    features: ['Student support bots', 'Course information', 'Automated assistance'],
  },
  {
    icon: Building2,
    title: 'Finance',
    description: 'Automate customer service and account management with secure AI bots.',
    color: 'from-red-500 to-red-600',
    features: ['Account inquiries', 'Transaction support', 'Financial information bots'],
  },
  {
    icon: Car,
    title: 'Automotive',
    description: 'Enhance customer experience with AI bots for sales and service inquiries.',
    color: 'from-red-500 to-red-600',
    features: ['Sales inquiries', 'Service scheduling', 'Customer support'],
  },
  {
    icon: Plane,
    title: 'Travel & Hospitality',
    description: 'Automate booking and guest services with intelligent AI bots.',
    color: 'from-red-500 to-red-600',
    features: ['Booking assistance', 'Guest support', 'Information automation'],
  },
]

const IndustriesSection = () => {
  return (
    <section className="py-24 bg-neutral-800 border-t border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-6"
          >
            AI Bots & Automation for
            <span className="block gradient-text">Every Industry</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-300 max-w-3xl mx-auto"
          >
            Discover how <span className="text-red-400 font-semibold">Voca's</span> AI bots and automation solutions can transform your business operations 
            and enhance customer experiences across all sectors.
          </motion.p>
        </div>

        {/* Industries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {industries.map((industry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="card-hover rounded-2xl p-8 h-full">
                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-r ${industry.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <industry.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-4 group-hover:text-red-400 transition-colors duration-300">
                  {industry.title}
                </h3>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  {industry.description}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {industry.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm text-gray-300">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Learn More Link */}
                <Link
                  href="/industries"
                  className="inline-flex items-center text-red-400 hover:text-red-300 font-medium group-hover:translate-x-1 transition-transform duration-200"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 rounded-2xl p-12 border border-red-500/20">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Industry?
            </h3>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Let's discuss how <span className="text-red-400 font-semibold">Voca</span> can help you implement AI bots and automation 
              solutions tailored to your specific industry needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/chat-agent"
                className="btn-primary text-white px-8 py-3 rounded-lg text-lg font-semibold transition-all duration-200"
              >
                Try Demo
              </Link>
              <Link
                href="#contact"
                className="btn-secondary px-8 py-3 rounded-lg text-lg font-semibold transition-all duration-200"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default IndustriesSection
