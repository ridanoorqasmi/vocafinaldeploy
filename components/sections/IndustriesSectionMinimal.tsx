'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, Heart, GraduationCap, Building2, Car, Plane } from 'lucide-react'

const industries = [
  {
    icon: ShoppingCart,
    title: 'E-commerce',
  },
  {
    icon: Heart,
    title: 'Healthcare',
  },
  {
    icon: GraduationCap,
    title: 'Education',
  },
  {
    icon: Building2,
    title: 'Finance',
  },
  {
    icon: Car,
    title: 'Automotive',
  },
  {
    icon: Plane,
    title: 'Travel & Hospitality',
  },
]

const IndustriesSectionMinimal = () => {
  return (
    <section className="relative py-24 bg-neutral-800 border-t border-gray-700/50 overflow-hidden">
      {/* Subtle animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/2 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <motion.h2
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-white mb-4"
          >
            Trusted across industries
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-lg text-gray-300 max-w-2xl mx-auto"
          >
            Voca's AI agents work seamlessly across different sectors and use cases.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {industries.map((industry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              viewport={{ once: true }}
              whileHover={{ y: -5, scale: 1.05 }}
              className="group relative flex flex-col items-center justify-center p-6 rounded-lg bg-neutral-900/50 border border-gray-700/30 hover:border-red-500/50 transition-all duration-300 cursor-pointer"
            >
              {/* Glow effect on hover */}
              <motion.div
                className="absolute inset-0 rounded-lg bg-red-500/0 group-hover:bg-red-500/10 blur-xl"
                transition={{ duration: 0.3 }}
              />

              {/* Animated icon container */}
              <motion.div
                className="relative w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center mb-3"
                whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-lg bg-red-500/50 blur-md"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.2,
                  }}
                />
                <industry.icon className="relative z-10 w-6 h-6 text-white" />
              </motion.div>

              <motion.p
                className="text-sm font-medium text-gray-300 text-center group-hover:text-white transition-colors duration-300"
                whileHover={{ scale: 1.05 }}
              >
                {industry.title}
              </motion.p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default IndustriesSectionMinimal

