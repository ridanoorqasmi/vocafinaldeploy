'use client'

import { motion } from 'framer-motion'

const statements = [
  'Most AI tools assist. Voca executes.',
  'Most bots answer questions. Voca completes tasks.',
  'Most platforms demo AI. Voca deploys it.',
]

const WhyVocaDifferentSection = () => {
  return (
    <section className="py-24 bg-neutral-900 border-t border-red-500/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
            Why Voca feels different
          </h2>
        </motion.div>

        <div className="space-y-8">
          {statements.map((statement, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="text-2xl md:text-3xl font-semibold text-white leading-relaxed">
                {statement}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default WhyVocaDifferentSection





