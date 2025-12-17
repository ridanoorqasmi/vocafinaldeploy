'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'CTO',
    company: 'TechFlow Solutions',
    content: 'Voca has revolutionized our customer support. The voice AI handles 80% of our inquiries automatically, reducing response times from hours to seconds.',
    rating: 5,
    avatar: '/api/placeholder/60/60',
  },
  {
    name: 'Michael Chen',
    role: 'Product Manager',
    company: 'HealthCare Plus',
    content: 'Implementing Voca in our healthcare platform has improved patient engagement significantly. The voice assistant makes medical information more accessible.',
    rating: 5,
    avatar: '/api/placeholder/60/60',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Head of Operations',
    company: 'EduTech Innovations',
    content: 'Our students love the voice learning assistant. It has made our educational platform more interactive and engaging for all age groups.',
    rating: 5,
    avatar: '/api/placeholder/60/60',
  },
  {
    name: 'David Thompson',
    role: 'CEO',
    company: 'AutoDrive Systems',
    content: 'Voca\'s automotive voice solutions have set a new standard for in-car experience. Our customers can\'t imagine driving without it now.',
    rating: 5,
    avatar: '/api/placeholder/60/60',
  },
  {
    name: 'Lisa Wang',
    role: 'VP of Customer Experience',
    company: 'RetailMax',
    content: 'The voice shopping assistant has increased our conversion rates by 35%. Customers find it incredibly intuitive and helpful.',
    rating: 5,
    avatar: '/api/placeholder/60/60',
  },
  {
    name: 'Robert Kim',
    role: 'Director of Innovation',
    company: 'BankSecure',
    content: 'Security and convenience - Voca delivers both. Our voice banking features have received excellent feedback from customers.',
    rating: 5,
    avatar: '/api/placeholder/60/60',
  },
]

const TestimonialsSection = () => {
  return (
    <section className="py-24 bg-neutral-900 border-t border-red-500/20">
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
            Trusted by Industry Leaders
            <span className="block gradient-text">Worldwide</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-300 max-w-3xl mx-auto"
          >
            See what our customers say about how <span className="text-red-400 font-semibold">Voca</span> has transformed their businesses 
            and enhanced their customer experiences.
          </motion.p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="card-hover rounded-2xl p-8 h-full relative">
                {/* Quote Icon */}
                <div className="absolute top-6 right-6 text-red-500/30 group-hover:text-red-400 transition-colors duration-300">
                  <Quote className="w-8 h-8" />
                </div>

                {/* Rating */}
                <div className="flex items-center mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-red-400 fill-current" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-gray-300 mb-6 leading-relaxed italic">
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-semibold text-lg mr-4">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-400">{testimonial.role}</div>
                    <div className="text-sm text-red-400">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8"
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-red-400 mb-2">500+</div>
            <div className="text-gray-300">Happy Customers</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-400 mb-2">99.9%</div>
            <div className="text-gray-300">Satisfaction Rate</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-400 mb-2">24/7</div>
            <div className="text-gray-300">Support Available</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-400 mb-2">50M+</div>
            <div className="text-gray-300">Voice Interactions</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default TestimonialsSection
