'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden ai-network-bg">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}>
          <motion.div
            className="absolute inset-0"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'linear'
            }}
          />
        </div>
      </div>

      {/* Enhanced ambient background gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Enhanced floating particles with glow */}
      {[...Array(30)].map((_, i) => {
        const randomX = Math.random() * 100
        const randomY = Math.random() * 100
        const randomDuration = Math.random() * 8 + 8
        const randomDelay = Math.random() * 5
        const randomXMove = Math.random() * 50 - 25
        
        return (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-red-500/40 rounded-full blur-sm"
            style={{
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
              left: `${randomX}%`,
              top: `${randomY}%`,
            }}
            animate={{
              y: [0, -100, 0],
              x: [0, randomXMove, 0],
              opacity: [0, 1, 0.5, 1, 0],
              scale: [0.5, 1, 0.8, 1, 0.5],
            }}
            transition={{
              duration: randomDuration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: randomDelay,
            }}
          />
        )
      })}

      {/* Animated connecting lines effect */}
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(239, 68, 68, 0)" />
            <stop offset="50%" stopColor="rgba(239, 68, 68, 0.5)" />
            <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
          </linearGradient>
        </defs>
        {[...Array(5)].map((_, i) => (
          <motion.line
            key={i}
            x1={`${20 + i * 20}%`}
            y1="0%"
            x2={`${20 + i * 20}%`}
            y2="100%"
            stroke="url(#lineGradient)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: [0, 1, 0],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          {/* Main Heading with staggered reveal and gradient effect */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight relative"
          >
            <span className="relative z-10 bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">
              Transform your business with AI Agents & automations.
            </span>
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-red-500 via-red-400 to-red-500 bg-clip-text text-transparent opacity-0"
              animate={{
                opacity: [0, 0.3, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              Transform your business with AI Agents & automations.
            </motion.span>
          </motion.h1>

          {/* Subheadline with fade and slide */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed relative"
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
            >
              Voca provides AI agents that help businesses handle customer conversations, internal workflows, and repetitive daily tasks, reliably and at scale.
            </motion.span>
          </motion.p>

          {/* CTA Button with glow effect */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex justify-center"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <motion.div
                className="absolute inset-0 bg-red-500 rounded-lg blur-xl opacity-50"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <Link
                href="/AI-agent"
                className="group relative btn-primary text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-red-500/50 hover:-translate-y-0.5 border border-red-500/20"
              >
                <span>Try Live Agent Demo</span>
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
