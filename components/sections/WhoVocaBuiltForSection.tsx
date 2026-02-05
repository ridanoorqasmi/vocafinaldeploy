'use client'

import { motion } from 'framer-motion'

const WhoVocaBuiltForSection = () => {
  return (
    <section className="py-24 bg-neutral-800 border-t border-gray-700/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-2xl md:text-3xl text-white leading-relaxed">
            Built for startups, SMEs, and teams that want AI to actually do work — not just answer questions.
          </p>
          
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-gray-300">
            <span>Operations teams</span>
            <span className="text-gray-500">•</span>
            <span>Support teams</span>
            <span className="text-gray-500">•</span>
            <span>Founders and admins</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default WhoVocaBuiltForSection





