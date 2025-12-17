'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Mic, ArrowRight, CheckCircle, Mail, Phone, MapPin } from 'lucide-react'

const CTASection = () => {
  return (
    <section className="py-24 bg-neutral-800 text-white border-t border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Transform Your Business with <span className="text-red-400">AI Voice</span>?
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Join thousands of businesses already using <span className="text-red-400 font-semibold">Voca</span> to enhance customer experience, 
              streamline operations, and drive growth with AI-powered voice assistants.
            </p>

            {/* Benefits */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <span className="text-gray-300">Free 14-day trial with full features</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <span className="text-gray-300">No credit card required to start</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <span className="text-gray-300">24/7 expert support included</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <span className="text-gray-300">Cancel anytime, no questions asked</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/chat-agent"
                className="group btn-primary text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Mic className="w-5 h-5" />
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              <Link
                href="#contact"
                className="btn-secondary px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 flex items-center justify-center"
              >
                Schedule Demo
              </Link>
            </div>
          </motion.div>

          {/* Right Content - Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8"
          >
            <h3 className="text-2xl font-bold mb-6">Get Started Today</h3>
            <form className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="w-full px-4 py-3 bg-neutral-900/50 border border-red-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="w-full px-4 py-3 bg-neutral-900/50 border border-red-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">
                  Company
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  className="w-full px-4 py-3 bg-neutral-900/50 border border-red-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your company name"
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="w-full px-4 py-3 bg-neutral-900/50 border border-red-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  placeholder="Tell us about your project..."
                />
              </div>
              
              <button
                type="submit"
                className="w-full btn-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Get Started
              </button>
            </form>

            {/* Contact Info */}
            <div className="mt-8 pt-8 border-t border-red-500/20">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-red-400" />
                  <span className="text-gray-300">hello@voca.ai</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-red-400" />
                  <span className="text-gray-300">+1 (555) 123-4567</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-red-400" />
                  <span className="text-gray-300">San Francisco, CA</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default CTASection
