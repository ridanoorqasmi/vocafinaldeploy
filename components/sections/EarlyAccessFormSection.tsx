'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

const EarlyAccessFormSection = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    businessEmail: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return false
    }
    // Check for common personal email domains
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com']
    const domain = email.split('@')[1]?.toLowerCase()
    return !personalDomains.includes(domain || '')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Reset errors
    const newErrors: Record<string, string> = {}

    // Validate Full Name
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    // Validate Company Name
    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required'
    }

    // Validate Business Email
    if (!formData.businessEmail.trim()) {
      newErrors.businessEmail = 'Business email is required'
    } else if (!validateEmail(formData.businessEmail)) {
      newErrors.businessEmail = 'Please use a business email address'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: Replace with actual API endpoint when ready
      // For now, this is stubbed to not break existing backend
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Clear form and errors after successful submission
      setFormData({ fullName: '', companyName: '', businessEmail: '' })
      setErrors({})
    } catch (error) {
      console.error('Form submission error:', error)
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="relative py-32 bg-neutral-900 text-white border-t border-red-500/20 overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/2 w-96 h-96 bg-red-500/5 rounded-full blur-3xl -translate-x-1/2"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-64 h-64 bg-red-500/5 rounded-full blur-3xl"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center"
        >
          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-4 relative"
          >
            <span className="relative z-10 bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
              Ready to see AI agents at work for your business?
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
              Ready to see AI agents at work for your business?
            </motion.span>
          </motion.h2>
          
          {/* Supporting Text */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-lg text-gray-300 mb-12 max-w-xl mx-auto"
          >
            Tell us a bit about your business and get access to AI agents built for real workflows.
          </motion.p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {errors.general}
              </div>
            )}

            {/* Full Name */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2 text-left">
                Full Name <span className="text-red-400">*</span>
              </label>
              <motion.div
                whileFocus={{ scale: 1.01 }}
                className="relative"
              >
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-neutral-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-300 ${
                    errors.fullName
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-700 focus:border-red-500 focus:ring-red-500/50'
                  }`}
                  placeholder="John Doe"
                  required
                />
                {formData.fullName && !errors.fullName && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"
                  />
                )}
              </motion.div>
              {errors.fullName && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 text-sm text-red-400 text-left"
                >
                  {errors.fullName}
                </motion.p>
              )}
            </motion.div>

            {/* Company Name */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-2 text-left">
                Company Name <span className="text-red-400">*</span>
              </label>
              <motion.div
                whileFocus={{ scale: 1.01 }}
                className="relative"
              >
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-neutral-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-300 ${
                    errors.companyName
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-700 focus:border-red-500 focus:ring-red-500/50'
                  }`}
                  placeholder="Acme Inc."
                  required
                />
                {formData.companyName && !errors.companyName && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"
                  />
                )}
              </motion.div>
              {errors.companyName && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 text-sm text-red-400 text-left"
                >
                  {errors.companyName}
                </motion.p>
              )}
            </motion.div>

            {/* Business Email */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              viewport={{ once: true }}
            >
              <label htmlFor="businessEmail" className="block text-sm font-medium text-gray-300 mb-2 text-left">
                Business Email <span className="text-red-400">*</span>
              </label>
              <motion.div
                whileFocus={{ scale: 1.01 }}
                className="relative"
              >
                <input
                  type="email"
                  id="businessEmail"
                  name="businessEmail"
                  value={formData.businessEmail}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-neutral-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-300 ${
                    errors.businessEmail
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-700 focus:border-red-500 focus:ring-red-500/50'
                  }`}
                  placeholder="john@acme.com"
                  required
                />
                {formData.businessEmail && !errors.businessEmail && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"
                  />
                )}
              </motion.div>
              {errors.businessEmail && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 text-sm text-red-400 text-left"
                >
                  {errors.businessEmail}
                </motion.p>
              )}
              <p className="mt-2 text-xs text-gray-400 text-left">
                Please use a business email address (personal emails like Gmail or Yahoo are not accepted)
              </p>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <motion.div
                className="absolute inset-0 bg-red-500 rounded-lg blur-xl opacity-50"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group relative w-full btn-primary text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2 hover:shadow-2xl hover:shadow-red-500/50 border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isSubmitting ? 'Submitting...' : 'I want to try AI Agents'}</span>
                {!isSubmitting && (
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
                )}
              </motion.button>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </section>
  )
}

export default EarlyAccessFormSection

