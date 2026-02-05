'use client'

import { motion } from 'framer-motion'
import { MessageSquare, CheckSquare, Workflow } from 'lucide-react'

const capabilities = [
  {
    icon: MessageSquare,
    title: 'AI Support Agent',
    description: 'Handles customer questions, follow-ups, and routine requests with context and consistency.',
  },
  {
    icon: CheckSquare,
    title: 'AI Task Agent',
    description: 'Executes repetitive internal tasks such as lookups, status checks, reminders, and daily operations.',
  },
  {
    icon: Workflow,
    title: 'AI Workflow Agent',
    description: 'Connects systems, triggers actions, and keeps processes running without manual intervention.',
  },
]

const WhatVocaDoesSection = () => {
  return (
    <section className="relative py-24 bg-neutral-900 border-t border-red-500/20 overflow-hidden">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, 30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4 relative"
          >
            <span className="relative z-10 bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
              What your AI agents can handle for you
            </span>
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-red-500 via-red-400 to-red-500 bg-clip-text text-transparent opacity-0 blur-sm"
              animate={{
                opacity: [0, 0.2, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              What your AI agents can handle for you
            </motion.span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-300 max-w-2xl mx-auto"
          >
            Voca agents are designed to take ownership of everyday business tasks — not just assist, but execute.
          </motion.p>
        </motion.div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {capabilities.map((capability, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              viewport={{ once: true }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group"
            >
              <div className="relative card-hover rounded-xl p-8 h-full text-center transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/20 border border-transparent hover:border-red-500/30">
                {/* Glowing background on hover */}
                <motion.div
                  className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500/0 via-red-500/0 to-red-500/0 opacity-0 group-hover:opacity-10 blur-xl"
                  transition={{ duration: 0.3 }}
                />
                
                {/* Animated border glow */}
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-red-500/0 group-hover:border-red-500/50"
                  initial={false}
                  animate={{
                    boxShadow: [
                      '0 0 0px rgba(239, 68, 68, 0)',
                      '0 0 20px rgba(239, 68, 68, 0.3)',
                      '0 0 0px rgba(239, 68, 68, 0)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />

                {/* Icon with enhanced animation */}
                <motion.div
                  className="relative w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-6 mx-auto"
                  whileHover={{ scale: 1.15, rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-red-500/50 blur-md"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <capability.icon className="relative z-10 w-8 h-8 text-white" />
                </motion.div>

                {/* Content */}
                <motion.h3
                  className="text-xl font-semibold text-white mb-4 group-hover:text-red-400 transition-colors duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  {capability.title}
                </motion.h3>
                <p className="text-gray-300 leading-relaxed">
                  {capability.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default WhatVocaDoesSection



