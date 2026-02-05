'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const CTASection = () => {
  return (
    <section className="py-32 bg-neutral-800 text-white border-t border-gray-700/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            See an AI agent actually do the work
          </h2>
          <p className="text-xl text-gray-300 mb-12">
            No slides. No promises. Just a live demo.
          </p>

          <Link
            href="/chat-agent"
            className="group inline-flex btn-primary text-white px-10 py-5 rounded-lg text-lg font-semibold transition-all duration-300 items-center space-x-2 hover:shadow-lg hover:shadow-red-500/25 hover:-translate-y-0.5"
          >
            <span>Try Live Demo</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export default CTASection

